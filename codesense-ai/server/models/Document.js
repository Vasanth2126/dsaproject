import { v4 as uuidv4 } from "uuid";
import { getCollection, saveDB } from "../config/db.js";

const Document = {
  async create({ project, filePath, chunkIndex, content, embedding }) {
    const documents = getCollection("documents");
    const newDoc = {
      _id: uuidv4(),
      project: String(project),
      filePath,
      chunkIndex,
      content,
      embedding,
      createdAt: new Date().toISOString(),
    };
    documents.push(newDoc);
    saveDB();
    return newDoc;
  },

  async find(query = {}) {
    const documents = getCollection("documents");
    return documents.filter((d) => {
      for (const [k, v] of Object.entries(query)) {
        if (d[k] !== String(v) && d[k] !== v) return false;
      }
      return true;
    });
  },

  async deleteMany(query = {}) {
    const documents = getCollection("documents");
    const initialLen = documents.length;
    const remaining = documents.filter((d) => {
      for (const [k, v] of Object.entries(query)) {
        if (d[k] === String(v) || d[k] === v) return false;
      }
      return true;
    });
    dbDataReplace("documents", remaining);
    saveDB();
    return { deletedCount: initialLen - remaining.length };
  },
};

function dbDataReplace(key, arr) {
  const col = getCollection(key);
  col.length = 0;
  col.push(...arr);
}

export default Document;
