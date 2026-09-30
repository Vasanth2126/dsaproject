import { v4 as uuidv4 } from "uuid";
import { getCollection, saveDB } from "../config/db.js";

function wrapProject(proj) {
  if (!proj) return null;
  const instance = { ...proj };
  instance.save = async function () {
    const projects = getCollection("projects");
    const idx = projects.findIndex((p) => p._id === instance._id);
    if (idx !== -1) {
      instance.updatedAt = new Date().toISOString();
      projects[idx] = { ...instance };
      saveDB();
    }
    return instance;
  };
  return instance;
}

const Project = {
  async create({ owner, name, sourceType, sourceRef, status = "pending" }) {
    const projects = getCollection("projects");
    const newProject = {
      _id: uuidv4(),
      owner: String(owner),
      name: name?.trim(),
      sourceType,
      sourceRef,
      status,
      fileCount: 0,
      chunkCount: 0,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    projects.push(newProject);
    saveDB();
    return wrapProject(newProject);
  },

  find(query = {}) {
    const projects = getCollection("projects");
    let matched = projects.filter((p) => {
      for (const [k, v] of Object.entries(query)) {
        if (p[k] !== String(v) && p[k] !== v) return false;
      }
      return true;
    }).map(wrapProject);

    // Support chained .sort()
    const queryObj = {
      sort(sortOptions = {}) {
        if (sortOptions.createdAt === -1) {
          matched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (sortOptions.createdAt === 1) {
          matched.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
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

  async findOne(query) {
    const projects = getCollection("projects");
    const found = projects.find((p) => {
      for (const [k, v] of Object.entries(query)) {
        if (p[k] !== String(v) && p[k] !== v) return false;
      }
      return true;
    });
    return wrapProject(found);
  },

  async findOneAndDelete(query) {
    const projects = getCollection("projects");
    const idx = projects.findIndex((p) => {
      for (const [k, v] of Object.entries(query)) {
        if (p[k] !== String(v) && p[k] !== v) return false;
      }
      return true;
    });
    if (idx === -1) return null;
    const [deleted] = projects.splice(idx, 1);
    saveDB();
    return wrapProject(deleted);
  },
};

export default Project;
