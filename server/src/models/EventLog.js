import mongoose from 'mongoose';

const eventLogSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    suggestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Suggestion', default: null },
    paperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paper', default: null },
    constructId: { type: mongoose.Schema.Types.ObjectId, ref: 'Construct', default: null },
    actorType: { type: String, enum: ['user', 'ai', 'system'], required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    label: { type: String, default: '' },
    action: { type: String, required: true },
    message: { type: String, default: '' },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

eventLogSchema.index({ projectId: 1, createdAt: -1 });

export const EventLog = mongoose.model('EventLog', eventLogSchema);
