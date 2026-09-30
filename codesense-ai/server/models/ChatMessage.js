import { v4 as uuidv4 } from "uuid";
import { getCollection, saveDB } from "../config/db.js";

const ChatMessage = {
  async create({ project, user, role, content, citedFiles = [] }) {
    const messages = getCollection("chatMessages");
    const newMsg = {
      _id: uuidv4(),
      project: String(project),
      user: String(user),
      role,
      content,
      citedFiles: Array.isArray(citedFiles) ? citedFiles : [],
      createdAt: new Date().toISOString(),
    };
    messages.push(newMsg);
    saveDB();
    return newMsg;
  },

  find(query = {}) {
    const messages = getCollection("chatMessages");
    let matched = messages.filter((m) => {
      for (const [k, v] of Object.entries(query)) {
        if (m[k] !== String(v) && m[k] !== v) return false;
      }
      return true;
    });

    const queryObj = {
      sort(sortOptions = {}) {
        if (sortOptions.createdAt === 1) {
          matched.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else if (sortOptions.createdAt === -1) {
          matched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        return matched;
      },
      then(resolve, reject) {
        return Promise.resolve(matched).then(resolve, reject);
      },
      [Symbol.iterator]() {
        return matched[Symbol.iterator]();
      },
    };

    return queryObj;
  },
};

export default ChatMessage;
