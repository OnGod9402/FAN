require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// Register fonts
GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/NotoSansEthiopic-VariableFont_wdth,wght.ttf'), 'NotoSansEthiopic');
GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/Roboto-VariableFont_wdth,wght.ttf'), 'Roboto');

const canvas = createCanvas(400, 400);
const ctx = canvas.getContext('2d');

ctx.fillStyle = '#e8f5e9'; // Approx bg color
ctx.fillRect(0, 0, 400, 400);

// Setup sizes
const fontSize = 24;
const lineSpacingRatio = 1.15; // Tight spacing
const lineH = Math.round(fontSize * lineSpacingRatio);

ctx.textAlign = 'left';
ctx.fillStyle = '#1a1a1a';

// Nationality
ctx.font = `800 ${fontSize}px NotoSansEthiopic`;
const natAmh = "ኢትዮጵያዊ";
ctx.fillText(natAmh, 30, 50);
const w1 = ctx.measureText(natAmh).width;

ctx.font = `500 ${fontSize}px Roboto`;
ctx.fillText(" | ", 30 + w1, 50);
const w2 = ctx.measureText(" | ").width;

ctx.font = `800 ${fontSize}px Roboto`;
ctx.fillText("Ethiopian", 30 + w1 + w2, 50);

// Address lines
const addrItems = [
  { amh: "ኦሮሚያ", eng: "Oromia" },
  { amh: "አርሲ", eng: "Arsi" },
  { amh: "ጤና", eng: "Tena" },
];

let addrY = 120;
for (const item of addrItems) {
  ctx.font = `800 ${fontSize}px NotoSansEthiopic`;
  ctx.fillText(item.amh, 30, addrY);
  addrY += lineH + 2; // slight extra gap between amh and eng? Actually wait, we want amh, eng, amh, eng.
  
  ctx.font = `800 ${fontSize}px Roboto`;
  ctx.fillText(item.eng, 30, addrY);
  addrY += lineH + 6; // Bigger gap for next block
}

fs.writeFileSync(path.join(__dirname, '../assets/scratch_back.png'), canvas.toBuffer('image/png'));
console.log("Written scratch_back.png");
