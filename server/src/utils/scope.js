import mongoose from 'mongoose';
import { HttpError } from '../middleware/error.js';
import { Project } from '../models/Project.js';
import { Paper } from '../models/Paper.js';
import { Suggestion } from '../models/Suggestion.js';
import { EventLog } from '../models/EventLog.js';

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

/** Returns the user's project or throws 404 (never reveals other users' data). */
export async function ownedProject(userId, id) {
  if (!validId(id)) throw new HttpError(404, 'Project not found.');
  const project = await Project.findOne({ _id: id, userId });
  if (!project) throw new HttpError(404, 'Project not found.');
  return project;
}

export async function ownedPaper(userId, id) {
  if (!validId(id)) throw new HttpError(404, 'Paper not found.');
  const paper = await Paper.findOne({ _id: id, userId });
  if (!paper) throw new HttpError(404, 'Paper not found.');
  return paper;
}

export async function ownedSuggestion(userId, id) {
  if (!validId(id)) throw new HttpError(404, 'Suggestion not found.');
  const suggestion = await Suggestion.findById(id);
  if (!suggestion) throw new HttpError(404, 'Suggestion not found.');
  await ownedProject(userId, suggestion.projectId); // authorization check
  return suggestion;
}

/** Logs an event in the project history. Never throws (logging must not break requests). */
export async function logEvent(entry) {
  try {
    await EventLog.create(entry);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[logEvent]', err.message);
  }
}
