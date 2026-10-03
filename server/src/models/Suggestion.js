import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema(
  {
    constructId: { type: mongoose.Schema.Types.ObjectId, ref: 'Construct' },
    name: { type: String, default: '' },
    paperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paper' },
    paperTitle: { type: String, default: '' },
    quote: { type: String, default: '' },
    page: { type: Number, default: null },
  },
  { _id: false }
);

const suggestionSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    type: { type: String, enum: ['jingle', 'jangle'], required: true, index: true },
    constructIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Construct', default: [] },
    names: { type: [String], default: [] },
    paperIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Paper', default: [] },
    score: { type: Number, min: 0, max: 1, default: 0 },
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    rationale: { type: String, default: '' },
    evidence: { type: [evidenceSchema], default: [] },
    evidenceComplete: { type: Boolean, default: true },
    aiProvider: { type: String, default: 'rule' },
    fingerprint: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'uncertain', 'edited'],
      default: 'pending',
      index: true,
    },
    decision: {
      action: { type: String, default: '' },
      note: { type: String, maxlength: 1000, default: '' },
      label: { type: String, maxlength: 200, default: '' },
      rationale: { type: String, maxlength: 1000, default: '' },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      userName: { type: String, default: '' },
      decidedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

suggestionSchema.index({ projectId: 1, fingerprint: 1 }, { unique: true });

export const Suggestion = mongoose.model('Suggestion', suggestionSchema);
