/**
 * Seeds the database with sample research data and runs the full AI pipeline
 * (extraction -> verification -> comparison) so every screen has content.
 *
 * Run: npm run seed --prefix server
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Project } from './models/Project.js';
import { Paper } from './models/Paper.js';
import { Construct } from './models/Construct.js';
import { Suggestion } from './models/Suggestion.js';
import { EventLog } from './models/EventLog.js';
import { extractPaperConstructs } from './services/extraction.js';
import { compareProject } from './services/compare.js';
import { SAMPLE_USER, SAMPLE_PROJECTS, SAMPLE_PAPERS } from './sampleData.js';

async function main() {
  await connectDB();

  // --- user (idempotent) ----------------------------------------------------
  const passwordHash = await bcrypt.hash(SAMPLE_USER.password, 12);
  const user = await User.findOneAndUpdate(
    { email: SAMPLE_USER.email },
    { $set: { name: SAMPLE_USER.name, passwordHash } },
    { upsert: true, new: true }
  );

  // --- clean previous demo data --------------------------------------------
  const oldProjects = await Project.find({ userId: user._id }).select('_id');
  const oldIds = oldProjects.map((p) => p._id);
  if (oldIds.length) {
    await Promise.all([
      Paper.deleteMany({ projectId: { $in: oldIds } }),
      Construct.deleteMany({ projectId: { $in: oldIds } }),
      Suggestion.deleteMany({ projectId: { $in: oldIds } }),
      EventLog.deleteMany({ projectId: { $in: oldIds } }),
      Project.deleteMany({ userId: user._id }),
    ]);
  }

  // --- projects -------------------------------------------------------------
  const projectByKey = new Map();
  for (const p of SAMPLE_PROJECTS) {
    const project = await Project.create({
      userId: user._id,
      name: p.name,
      description: p.description,
      researchQuestion: p.researchQuestion,
    });
    projectByKey.set(p.key, project);
    await EventLog.create({
      projectId: project._id,
      actorType: 'system',
      label: 'seed',
      action: 'project.create',
      message: `Sample project "${p.name}" was created by the seed script.`,
    });
  }

  // --- papers + AI extraction ------------------------------------------------
  let totalConstructs = 0;
  for (const s of SAMPLE_PAPERS) {
    const project = projectByKey.get(s.projectKey);
    const paper = await Paper.create({
      projectId: project._id,
      userId: user._id,
      title: s.title,
      authors: s.authors,
      year: s.year,
      sourceType: 'text',
      status: 'parsed',
      pageCount: s.pages.length,
      pages: s.pages,
      file: { originalName: '', storedName: '', sizeBytes: 0 },
    });
    const result = await extractPaperConstructs(paper);
    totalConstructs += result.created;
    console.log(`  ✓ "${s.title}": ${result.created} construct(s), ${result.dropped} dropped`);
  }

  // --- jingle/jangle comparison ---------------------------------------------
  const mainProject = projectByKey.get('main');
  const comparison = await compareProject(mainProject);

  const suggestions = await Suggestion.find({ projectId: mainProject._id }).lean();
  console.log('\nSeed complete.');
  console.log(`  Projects: ${SAMPLE_PROJECTS.length}`);
  console.log(`  Papers:   ${SAMPLE_PAPERS.length}`);
  console.log(`  Constructs: ${totalConstructs}`);
  console.log(`  Suggestions: ${suggestions.length} (${comparison.created} new, ${comparison.skipped} already known)`);
  for (const s of suggestions) {
    console.log(`    - [${s.type}] ${s.names.join(' ↔ ')} (confidence ${(s.confidence * 100).toFixed(0)}%)`);
  }
  console.log('\nSign in with:');
  console.log(`  email:    ${SAMPLE_USER.email}`);
  console.log(`  password: ${SAMPLE_USER.password}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
