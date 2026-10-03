/**
 * Generates a realistic 3-page sample academic PDF for testing the upload
 * pipeline end-to-end (no external services, pdfkit only).
 *
 * The text is written so that analysis produces:
 *  - JANGLE: "Knowledge sharing" (p.1) vs "Knowledge exchange" (p.2) —
 *            different names, near-identical definitions + synonym match.
 *  - JINGLE: "Team cohesion" defined differently on p.2 and p.3.
 *
 * Run: npm run make:sample --prefix server   (or: node scripts/make-sample-pdf.mjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, '../../samples/ConstructTrace-Sample-Paper.pdf');
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const doc = new PDFDocument({
  size: 'A4',
  margin: 72,
  info: {
    Title: 'Collaborative Learning in Distributed Teams: A Field Study',
    Author: 'Nguyen, T. & Alvarez, P.',
    Subject: 'Sample paper for ConstructTrace',
  },
});

const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

const title = (text) => doc.font('Times-Bold').fontSize(17).text(text, { align: 'center' }).moveDown(0.4);
const byline = (text) =>
  doc.font('Times-Italic').fontSize(11).text(text, { align: 'center' }).moveDown(1.2);
const heading = (text) => doc.font('Times-Bold').fontSize(13).text(text).moveDown(0.4);
const para = (text) => doc.font('Times-Roman').fontSize(11).text(text, { align: 'justify' }).moveDown(0.7);

/* ---------------------------------------------------------------- page 1 */
title('Collaborative Learning in Distributed Teams: A Field Study');
byline('Trang Nguyen & Pablo Alvarez — International Journal of Organizational Behaviour, 2023');

heading('1. Introduction');
para(
  'Distributed teams have become commonplace in contemporary organizations. Understanding how team members create and maintain shared understanding across distance remains an open question for organizational research.'
);
para(
  'Knowledge sharing is defined as the process by which individuals exchange work-related expertise, skills and insights with their colleagues (Bock et al., 2005).'
);
para(
  'We assessed knowledge sharing using a six-item scale adapted from Reychan and Hung (2015). Items such as "I share my expertise with other team members" were rated on a seven-point scale ranging from 1 (never) to 7 (always).'
);
para(
  'Prior studies link collaborative learning behaviors with performance and with reduced coordination costs in distributed settings (Wong and Singh, 2021).'
);

/* ---------------------------------------------------------------- page 2 */
doc.addPage();
heading('2. Theoretical background');
para(
  'An alternative tradition treats the same phenomenon as knowledge exchange refers to the process through which individuals transfer work-related expertise, skills and insights to their colleagues.'
);
para(
  'Knowledge exchange was measured with a five-item scale. Items such as "Colleagues often share their knowledge with me" were completed by 92 software engineers in a cross-sectional survey.'
);
para(
  'Following Ritchie (2019), team cohesion is defined here as the ratio of task interdependence to interpersonal conflict within a work team, computed from quarterly collaboration metrics.'
);
para(
  'This operationalization differs from earlier survey-based approaches and is included to examine metric-driven team analytics.'
);

/* ---------------------------------------------------------------- page 3 */
doc.addPage();
heading('3. Method and results');
para(
  'Team cohesion refers to the degree of mutual commitment, trust and bonding that holds a work team together (Mullen and Copper, 1994).'
);
para(
  'Team cohesion was assessed using a four-item scale. Items such as "Members of this team pull together" were rated by 92 employees on a five-point Likert scale. Cronbach alpha was .87.'
);
para(
  'Knowledge sharing correlated positively with team cohesion (r = .41, p < .01) and with self-rated performance (r = .29, p < .05).'
);
heading('4. Limitations');
para(
  'The cross-sectional design, single-source ratings and concentration of participants in one industry limit causal claims. Future research should employ longitudinal designs and objective performance records.'
);

doc.end();

await new Promise((resolve, reject) => {
  stream.on('finish', resolve);
  stream.on('error', reject);
});

console.log(`Sample PDF written: ${outPath} (${fs.statSync(outPath).size} bytes)`);
