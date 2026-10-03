import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    page: { type: Number, default: null },
  },
  { _id: false }
);

const constructSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    paperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paper', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    normalizedName: { type: String, required: true, trim: true, maxlength: 200, index: true },
    definition: { type: evidenceSchema, default: null },
    measurementItems: { type: [evidenceSchema], default: [] },
    evidenceQuotes: { type: [evidenceSchema], default: [] },
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    provider: { type: String, default: 'rule' },
    source: { type: String, enum: ['ai', 'human'], default: 'ai' },
    status: { type: String, enum: ['extracted', 'verified', 'edited'], default: 'extracted' },
    missingEvidence: { type: [String], default: [] },
    researcherNote: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

constructSchema.index({ projectId: 1, paperId: 1, normalizedName: 1 });

export const Construct = mongoose.model('Construct', constructSchema);
