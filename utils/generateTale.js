
const Anthropic = require('@anthropic-ai/sdk');

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function generateTale(params) {
  const {
    title,
    ageRange,
    topic,
    mainCharacter = '',
    setting = '',
    mood = 'happy',
    length = 'medium',
    moralLesson = ''
  } = params;

  // Determine word count based on length and age range
  let targetWordCount;
  if (ageRange === '3-5') {
    targetWordCount = length === 'short' ? 200 : length === 'medium' ? 350 : 500;
  } else if (ageRange === '6-8') {
    targetWordCount = length === 'short' ? 350 : length === 'medium' ? 600 : 900;
  } else { // 9-12
    targetWordCount = length === 'short' ? 500 : length === 'medium' ? 800 : 1200;
  }

  // Build character description
  const characterDescription = mainCharacter 
    ? `The main character is ${mainCharacter}.` 
    : '';

  // Build setting description
  const settingDescription = setting 
    ? `The story takes place in ${setting}.` 
    : '';

  // Build moral lesson instruction
  const moralLessonInstruction = moralLesson 
    ? `The story should teach a moral lesson about ${moralLesson}.` 
    : '';

  // Build age-appropriate language instruction
  let languageInstruction;
  if (ageRange === '3-5') {
    languageInstruction = 'Use simple language, short sentences, and repetition. The story should be very easy to understand for preschoolers.';
  } else if (ageRange === '6-8') {
    languageInstruction = 'Use clear language with some more advanced vocabulary. The story can have more complex plot elements while remaining easy to follow.';
  } else { // 9-12
    languageInstruction = 'Use rich vocabulary and more complex sentence structures. The story can include more nuanced themes and character development.';
  }

  // Build mood instruction
  const moodInstruction = `The overall tone of the story should be ${mood}.`;

  // Create the prompt
  const prompt = `
    Write an original children's tale with the title "${title}" about ${topic}. ${characterDescription} ${settingDescription}

    The story is for children aged ${ageRange} years. ${languageInstruction}

    ${moralLessonInstruction} ${moodInstruction}

    The story should be around ${targetWordCount} words long.

    Please write a complete, engaging story with a clear beginning, middle, and end. Include dialogue and descriptive language appropriate for the age group.
  `;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4000,
      temperature: 0.7,
      system: "You are an expert children's story writer. Your task is to write original, engaging, and age-appropriate tales for children.",
      messages: [
        { role: "user", content: prompt }
      ],
    });

    return response.content[0].text;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw new Error('Failed to generate tale');
  }
}

module.exports = generateTale;
