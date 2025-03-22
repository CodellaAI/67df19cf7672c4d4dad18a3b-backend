
const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Tale = require('../models/Tale');
const User = require('../models/User');
const generateTale = require('../utils/generateTale');

const router = express.Router();

// @route   POST /api/tales
// @desc    Create a new tale
// @access  Private
router.post('/', [
  auth,
  body('title', 'Title is required').not().isEmpty(),
  body('content', 'Content is required').not().isEmpty(),
  body('ageRange', 'Age range is required').not().isEmpty(),
  body('topic', 'Topic is required').not().isEmpty()
], async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { title, content, ageRange, topic, isPublic = false } = req.body;

    // Create new tale
    const tale = new Tale({
      title,
      content,
      ageRange,
      topic,
      isPublic,
      author: req.user.id
    });

    await tale.save();
    res.status(201).json(tale);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/tales/user
// @desc    Get all tales for the authenticated user
// @access  Private
router.get('/user', auth, async (req, res) => {
  try {
    const filter = { author: req.user.id };
    
    // Optional visibility filter
    if (req.query.visibility === 'public') {
      filter.isPublic = true;
    } else if (req.query.visibility === 'private') {
      filter.isPublic = false;
    }
    
    const tales = await Tale.find(filter)
      .sort({ createdAt: -1 })
      .populate('author', 'name');
      
    res.json(tales);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/tales/public
// @desc    Get all public tales
// @access  Public
router.get('/public', async (req, res) => {
  try {
    const filter = { isPublic: true };
    
    // Optional age range filter
    if (req.query.ageRange) {
      filter.ageRange = req.query.ageRange;
    }
    
    let query = Tale.find(filter).populate('author', 'name');
    
    // Sort options
    if (req.query.sort === 'oldest') {
      query = query.sort({ createdAt: 1 });
    } else if (req.query.sort === 'mostLiked') {
      query = query.sort({ likes: -1 });
    } else {
      // Default: newest first
      query = query.sort({ createdAt: -1 });
    }
    
    const tales = await query.exec();
    
    // If user is authenticated, check which tales they've liked
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        const userId = decoded.user.id;
        
        const user = await User.findById(userId);
        
        // Add isLiked field to each tale
        const talesWithLikeInfo = tales.map(tale => {
          const taleObj = tale.toObject();
          taleObj.isLiked = user.likedTales.includes(tale._id);
          return taleObj;
        });
        
        return res.json(talesWithLikeInfo);
      } catch (error) {
        // Token validation failed, continue without like info
        console.error('Error validating token:', error);
      }
    }
    
    res.json(tales);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/tales/:id
// @desc    Get a single tale by ID
// @access  Public for public tales, Private for user's own tales
router.get('/:id', async (req, res) => {
  try {
    const tale = await Tale.findById(req.params.id).populate('author', 'name');
    
    if (!tale) {
      return res.status(404).json({ message: 'Tale not found' });
    }
    
    // If tale is private, check if user is the author
    if (!tale.isPublic) {
      // Check if user is authenticated
      if (!req.headers.authorization) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        const userId = decoded.user.id;
        
        // If user is not the author, deny access
        if (tale.author._id.toString() !== userId) {
          return res.status(403).json({ message: 'Access denied' });
        }
      } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
      }
    }
    
    // If user is authenticated, check if they've liked this tale
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        const userId = decoded.user.id;
        
        const user = await User.findById(userId);
        const taleObj = tale.toObject();
        taleObj.isLiked = user.likedTales.includes(tale._id);
        
        return res.json(taleObj);
      } catch (error) {
        // Token validation failed, continue without like info
        console.error('Error validating token:', error);
      }
    }
    
    res.json(tale);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Tale not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   PATCH /api/tales/:id
// @desc    Update a tale
// @access  Private (only tale author)
router.patch('/:id', auth, async (req, res) => {
  try {
    const tale = await Tale.findById(req.params.id);
    
    if (!tale) {
      return res.status(404).json({ message: 'Tale not found' });
    }
    
    // Check if user is the author
    if (tale.author.toString() !== req.user.id) {
      return res.status(403).json({ message: 'User not authorized' });
    }
    
    // Fields that can be updated
    const { title, content, isPublic } = req.body;
    
    // Update fields if provided
    if (title) tale.title = title;
    if (content) tale.content = content;
    if (isPublic !== undefined) tale.isPublic = isPublic;
    
    await tale.save();
    res.json(tale);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Tale not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   DELETE /api/tales/:id
// @desc    Delete a tale
// @access  Private (only tale author)
router.delete('/:id', auth, async (req, res) => {
  try {
    const tale = await Tale.findById(req.params.id);
    
    if (!tale) {
      return res.status(404).json({ message: 'Tale not found' });
    }
    
    // Check if user is the author
    if (tale.author.toString() !== req.user.id) {
      return res.status(403).json({ message: 'User not authorized' });
    }
    
    await tale.remove();
    
    res.json({ message: 'Tale removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Tale not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   POST /api/tales/generate
// @desc    Generate a tale using Claude AI
// @access  Private
router.post('/generate', auth, async (req, res) => {
  try {
    const { 
      title, 
      ageRange, 
      topic,
      mainCharacter,
      setting,
      mood,
      length,
      moralLesson
    } = req.body;
    
    // Generate tale using Claude AI
    const content = await generateTale({
      title,
      ageRange,
      topic,
      mainCharacter,
      setting,
      mood,
      length,
      moralLesson
    });
    
    res.json({ content });
  } catch (err) {
    console.error('Error generating tale:', err);
    res.status(500).json({ message: 'Failed to generate tale' });
  }
});

// @route   POST /api/tales/:id/like
// @desc    Like a tale
// @access  Private
router.post('/:id/like', auth, async (req, res) => {
  try {
    const tale = await Tale.findById(req.params.id);
    
    if (!tale) {
      return res.status(404).json({ message: 'Tale not found' });
    }
    
    // Check if tale is public
    if (!tale.isPublic) {
      return res.status(403).json({ message: 'Cannot like a private tale' });
    }
    
    const user = await User.findById(req.user.id);
    
    // Check if user has already liked this tale
    if (user.likedTales.includes(tale._id)) {
      return res.status(400).json({ message: 'Tale already liked' });
    }
    
    // Add tale to user's liked tales
    user.likedTales.push(tale._id);
    await user.save();
    
    // Increment tale's like count
    tale.likes += 1;
    await tale.save();
    
    res.json({ likes: tale.likes });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Tale not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   DELETE /api/tales/:id/like
// @desc    Unlike a tale
// @access  Private
router.delete('/:id/like', auth, async (req, res) => {
  try {
    const tale = await Tale.findById(req.params.id);
    
    if (!tale) {
      return res.status(404).json({ message: 'Tale not found' });
    }
    
    const user = await User.findById(req.user.id);
    
    // Check if user has liked this tale
    if (!user.likedTales.includes(tale._id)) {
      return res.status(400).json({ message: 'Tale not liked yet' });
    }
    
    // Remove tale from user's liked tales
    user.likedTales = user.likedTales.filter(
      taleId => taleId.toString() !== tale._id.toString()
    );
    await user.save();
    
    // Decrement tale's like count
    tale.likes = Math.max(0, tale.likes - 1);
    await tale.save();
    
    res.json({ likes: tale.likes });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Tale not found' });
    }
    res.status(500).send('Server error');
  }
});

module.exports = router;
