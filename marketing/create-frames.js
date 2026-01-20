/**
 * MemoryAisle App Store Screenshot Frame Generator
 *
 * This script adds marketing frames, text overlays, and device frames
 * to raw screenshots for App Store submission.
 *
 * Usage: node create-frames.js
 *
 * Prerequisites:
 *   npm install sharp canvas
 */

const fs = require('fs');
const path = require('path');

// Marketing copy for each screenshot
const MARKETING_COPY = [
  {
    id: '01_hero',
    headline: 'Smart Grocery\nShopping',
    subheadline: 'AI-powered lists that learn your preferences',
  },
  {
    id: '02_voice',
    headline: 'Just Speak.\nMira Listens.',
    subheadline: 'Hands-free voice commands with Mira AI',
  },
  {
    id: '03_family',
    headline: 'Shop Together,\nApart',
    subheadline: 'Real-time sync with up to 12 family members',
  },
  {
    id: '04_mealplan',
    headline: 'Plan Your\nWeek',
    subheadline: 'AI-generated meal plans and grocery lists',
  },
  {
    id: '05_recipes',
    headline: 'Recipes That\nFit Your Life',
    subheadline: 'Personalized suggestions based on preferences',
  },
  {
    id: '06_traditions',
    headline: 'Remember\nEvery Tradition',
    subheadline: 'Holiday shopping lists saved and ready',
  },
  {
    id: '07_premium',
    headline: 'Unlimited\nPossibilities',
    subheadline: 'Premium features for power shoppers',
  },
];

// Device sizes (width x height)
const DEVICE_SIZES = {
  'iPhone_6.9': { width: 1320, height: 2868 },
  'iPhone_6.7': { width: 1290, height: 2796 },
  'iPhone_6.5': { width: 1242, height: 2688 },
  'iPhone_5.5': { width: 1242, height: 2208 },
  'iPad_12.9': { width: 2048, height: 2732 },
  'iPad_11': { width: 1668, height: 2388 },
};

// Brand colors
const COLORS = {
  background: '#F8F9FB',  // Cream/off-white
  gold: '#D4A547',        // Gold accent
  goldLight: '#E8D5A8',   // Light gold
  textPrimary: '#1A1A1A', // Near black
  textSecondary: '#6B7280', // Gray
};

// Frame layout configuration
const FRAME_CONFIG = {
  // Percentage of height for top text area
  topTextAreaPercent: 0.22,
  // Percentage to scale down the screenshot
  screenshotScalePercent: 0.72,
  // Corner radius for screenshot (percentage of width)
  cornerRadiusPercent: 0.03,
  // Padding from edges (percentage of width)
  paddingPercent: 0.05,
};

async function createFramedScreenshot(inputPath, outputPath, deviceSize, copyData) {
  try {
    // Dynamic import for ES modules
    const sharp = (await import('sharp')).default;
    const { createCanvas, loadImage, registerFont } = await import('canvas');

    const { width, height } = deviceSize;

    // Create canvas with device dimensions
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fill background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // Add subtle gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, 0, height * 0.4);
    gradient.addColorStop(0, 'rgba(212, 165, 71, 0.08)');
    gradient.addColorStop(1, 'rgba(212, 165, 71, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height * 0.4);

    // Calculate dimensions
    const padding = width * FRAME_CONFIG.paddingPercent;
    const topTextHeight = height * FRAME_CONFIG.topTextAreaPercent;

    // Draw headline
    const headlineFontSize = width * 0.072;
    ctx.font = `bold ${headlineFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillStyle = COLORS.textPrimary;
    ctx.textAlign = 'center';

    const headlineLines = copyData.headline.split('\n');
    let headlineY = topTextHeight * 0.4;
    headlineLines.forEach((line, index) => {
      ctx.fillText(line, width / 2, headlineY + (index * headlineFontSize * 1.1));
    });

    // Draw subheadline
    const subheadlineFontSize = width * 0.032;
    ctx.font = `400 ${subheadlineFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillStyle = COLORS.textSecondary;

    const subheadlineY = headlineY + (headlineLines.length * headlineFontSize * 1.1) + (subheadlineFontSize * 1.5);
    ctx.fillText(copyData.subheadline, width / 2, subheadlineY);

    // Load and draw screenshot
    if (fs.existsSync(inputPath)) {
      const screenshot = await loadImage(inputPath);

      // Calculate screenshot dimensions
      const screenshotTargetWidth = width * FRAME_CONFIG.screenshotScalePercent;
      const screenshotAspectRatio = screenshot.height / screenshot.width;
      const screenshotTargetHeight = screenshotTargetWidth * screenshotAspectRatio;

      // Position screenshot
      const screenshotX = (width - screenshotTargetWidth) / 2;
      const screenshotY = topTextHeight + padding;

      // Draw rounded rectangle clip path
      const cornerRadius = width * FRAME_CONFIG.cornerRadiusPercent;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(screenshotX, screenshotY, screenshotTargetWidth, screenshotTargetHeight, cornerRadius);
      ctx.clip();

      // Draw screenshot
      ctx.drawImage(screenshot, screenshotX, screenshotY, screenshotTargetWidth, screenshotTargetHeight);
      ctx.restore();

      // Add subtle shadow effect around screenshot
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(screenshotX, screenshotY, screenshotTargetWidth, screenshotTargetHeight, cornerRadius);
      ctx.stroke();
    } else {
      // Draw placeholder
      const placeholderWidth = width * FRAME_CONFIG.screenshotScalePercent;
      const placeholderHeight = height * 0.6;
      const placeholderX = (width - placeholderWidth) / 2;
      const placeholderY = topTextHeight + padding;

      ctx.fillStyle = '#E5E7EB';
      ctx.beginPath();
      ctx.roundRect(placeholderX, placeholderY, placeholderWidth, placeholderHeight, width * FRAME_CONFIG.cornerRadiusPercent);
      ctx.fill();

      ctx.fillStyle = COLORS.textSecondary;
      ctx.font = `400 ${width * 0.04}px -apple-system, sans-serif`;
      ctx.fillText('Screenshot Placeholder', width / 2, placeholderY + placeholderHeight / 2);
    }

    // Save output
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Created: ${outputPath}`);

  } catch (error) {
    console.error(`Error creating frame for ${inputPath}:`, error.message);
  }
}

async function processAllScreenshots() {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  const framedDir = path.join(__dirname, 'framed');

  // Create framed directory
  if (!fs.existsSync(framedDir)) {
    fs.mkdirSync(framedDir, { recursive: true });
  }

  // Process each device
  for (const [deviceName, deviceSize] of Object.entries(DEVICE_SIZES)) {
    const deviceInputDir = path.join(screenshotsDir, deviceName);
    const deviceOutputDir = path.join(framedDir, deviceName);

    if (!fs.existsSync(deviceOutputDir)) {
      fs.mkdirSync(deviceOutputDir, { recursive: true });
    }

    // Process each screenshot
    for (const copyData of MARKETING_COPY) {
      const inputPath = path.join(deviceInputDir, `${copyData.id}.png`);
      const outputPath = path.join(deviceOutputDir, `${copyData.id}_framed.png`);

      await createFramedScreenshot(inputPath, outputPath, deviceSize, copyData);
    }
  }

  console.log('\nDone! Framed screenshots are in the ./framed directory.');
}

// Run if called directly
if (require.main === module) {
  console.log('MemoryAisle Screenshot Frame Generator');
  console.log('======================================\n');

  // Check for required packages
  try {
    require.resolve('sharp');
    require.resolve('canvas');
  } catch (e) {
    console.log('Installing required packages...');
    console.log('Run: npm install sharp canvas\n');
    console.log('Then run this script again.');
    process.exit(1);
  }

  processAllScreenshots().catch(console.error);
}

module.exports = { createFramedScreenshot, MARKETING_COPY, DEVICE_SIZES };
