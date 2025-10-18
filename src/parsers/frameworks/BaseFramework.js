import fs from "fs";
import path from "path";

/**
 * Base class for framework detection and analysis.
 * All framework-specific analyzers inherit from this.
 */
export class BaseFramework {
  constructor(serviceDir) {
    this.serviceDir = serviceDir;
    this.packageJsonPath = path.join(serviceDir, "package.json");
  }

  /**
   * Detects if this framework is used in the service.
   * Must be implemented by child classes.
   */
  detect() {
    throw new Error("detect() must be implemented by child class");
  }

  /**
   * Returns the framework name.
   * Must be implemented by child classes.
   */
  getName() {
    throw new Error("getName() must be implemented by child class");
  }

  /**
   * Runs all security checks for this framework.
   * Must be implemented by child classes.
   */
  analyze(verbose = false) {
    throw new Error("analyze() must be implemented by child class");
  }

  /**
   * Helper: Check if a package exists in dependencies.
   */
  hasPackage(packageName) {
    if (!fs.existsSync(this.packageJsonPath)) {
      return false;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, "utf8"));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      return packageName in deps;
    } catch (err) {
      return false;
    }
  }

  /**
   * Helper: Recursively find all JS/TS files in a directory.
   */
  findJsFiles(dir, excludeDirs = ["node_modules"]) {
    const files = [];
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !excludeDirs.includes(item)) {
          files.push(...this.findJsFiles(fullPath, excludeDirs));
        } else if (item.endsWith(".js") || item.endsWith(".ts")) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      // Ignore
    }
    return files;
  }

  /**
   * Helper: Read file content safely.
   */
  readFile(filePath) {
    try {
      return fs.readFileSync(filePath, "utf8");
    } catch (err) {
      return null;
    }
  }
}
