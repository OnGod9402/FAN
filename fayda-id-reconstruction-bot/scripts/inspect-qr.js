const sharp = require('sharp');
const jsQR = require('jsqr');
const { Decoder } = require('cbor-x');

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error('Usage: node scripts/inspect-qr.js <image-path>');
    process.exit(1);
  }

  const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const qr = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  if (!qr) {
    console.error('No QR code detected');
    process.exit(2);
  }

  const raw = qr.binaryData ? Buffer.from(qr.binaryData) : Buffer.from(qr.data, 'binary');
  const decoder = new Decoder({ mapsAsObjects: false });
  const top = decoder.decode(raw);
  const cose = top.value ?? top;
  const payload = decoder.decode(Buffer.from(cose[2]));

  console.log('qrBytes:', raw.length);
  console.log('protectedHex:', Buffer.from(cose[0]).toString('hex'));
  console.log('signatureBytes:', Buffer.from(cose[3]).length);

  console.log('payloadKeys:', Array.from(payload.keys()));
  const nested = payload.get(169);
  if (nested instanceof Map) {
    console.log('payload169Keys:', Array.from(nested.keys()));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(3);
});
