import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(root, 'assets/pieces/chessiro');
const outFile = path.join(root, 'src/defaultPieceDataUris.ts');

const files = fs
  .readdirSync(assetsDir)
  .filter((file) => file.endsWith('.svg'))
  .sort();

const pieceCodes = files.map((file) => file.replace(/\.svg$/, ''));

function compactSvg(svg) {
  return svg
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function escapeTemplateLiteral(text) {
  return text.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

const svgEntries = pieceCodes
  .map((code) => {
    const svgPath = path.join(assetsDir, `${code}.svg`);
    const svg = compactSvg(fs.readFileSync(svgPath, 'utf8'));
    return `  ${code}: \`${escapeTemplateLiteral(svg)}\`,`;
  })
  .join('\n');

const uriEntries = pieceCodes
  .map((code) => `  ${code}: svgToDataUri(DEFAULT_PIECE_SVGS.${code}),`)
  .join('\n');

const pieceCodesArray = pieceCodes.map((code) => `'${code}'`).join(', ');

const output = `// Auto-generated from assets/pieces/chessiro/*.svg\n// Raw SVG strings compress better than pre-encoded URIs; data URIs are derived at module init.\n\nconst PIECE_CODES = [${pieceCodesArray}] as const;\ntype PieceCode = (typeof PIECE_CODES)[number];\n\nexport const DEFAULT_PIECE_SVGS: Record<PieceCode, string> = {\n${svgEntries}\n};\n\nfunction svgToDataUri(svg: string): string {\n  return \`data:image/svg+xml;utf8,\${encodeURIComponent(svg)}\`;\n}\n\nexport const DEFAULT_PIECE_DATA_URIS: Record<PieceCode, string> = {\n${uriEntries}\n};\n`;

fs.writeFileSync(outFile, output, 'utf8');
console.log(`Generated ${outFile}`);
