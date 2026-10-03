import mongoose from 'mongoose';

const pageSchema = new mongoose.Schema(
  {
    page: { type: Number, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const paperSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    authors: { type: String, trim: true, maxlength: 500, default: '' },
    year: { type: String, trim: true, maxlength: 20, default: '' },
    sourceType: { type: String, enum: ['pdf', 'text'], required: true },
    status: {
      type: String,
      enum: ['processing', 'parsed', 'analyzed', 'failed'],
      default: 'processing',
      index: true,
    },
    error: { type: String, default: '' },
    pageCount: { type: Number, default: 0 },
    pages: { type: [pageSchema], default: [] },
    file: {
      originalName: { type: String, default: '' },
      storedName: { type: String, default: '' },
      sizeBytes: { type: Number, default: 0 },
    },
    extractedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paperSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject({ virtuals: false });
  delete obj.pages; // full text is fetched via GET /api/papers/:id/pages
  obj.pageCount = this.pageCount;
  return obj;
};

export const Paper = mongoose.model('Paper', paperSchema);
