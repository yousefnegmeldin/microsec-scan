# Fixes Applied to microsec-scan

## Issues Fixed

### 1. JavaScript Files Not Being Scanned
**Problem:** The scanner was only finding 22 issues (all from docker-compose.yml) instead of 32+ issues.

**Root Cause:** The `glob` function was returning both files and directories. When the scanner tried to process directories as if they were files, it would fail silently.

**Solution:** Added the `nodir: true` option to the glob configuration in `src/scanner.js`:
```javascript
const files = await glob(`${baseDir}/**/*`, {
  ignore: ["**/node_modules/**", "**/dist/**"],
  nodir: true, // Only return files, not directories
});
```

### 2. Line Numbers Showing as "?"
**Problem:** All findings from docker-compose.yml showed "line ?" instead of actual line numbers.

**Root Cause:** The `composeParser.js` was using `js-yaml` to parse the YAML structure, but `js-yaml` doesn't provide line number information by default.

**Solution:** 
- Read the raw file content alongside the parsed YAML
- Created a `findLineNumber()` helper function that searches for strings in the raw content
- Track line numbers for each finding by searching for the relevant text (service names, environment variable values)

**Code added to `src/parsers/composeParser.js`:**
```javascript
function findLineNumber(content, searchString) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(searchString)) {
      return i + 1; // Return 1-indexed line number
    }
  }
  return undefined;
}
```

### 3. Comment Removal Breaking URL Detection (CRITICAL BUG)
**Problem:** The scanner was removing `amqp://` and `http://` URLs from the code before analyzing them, causing zero detections in JS files.

**Root Cause:** The comment removal regex `/\/\/[^\n\r]*/g` was designed to remove single-line comments like `// this is a comment`. However, it also matched `//` inside strings like `'amqp://guest:guest@rabbitmq:5672'`, effectively removing the entire URL!

**Example of the bug:**
```javascript
// Before comment removal:
url: 'amqp://guest:guest@rabbitmq:5672'

// After comment removal (WRONG!):
url: 'amqp:
```

The regex saw `//` and removed everything after it, thinking it was a comment.

**Solution:** Removed the single-line comment removal regex. Now we only remove multi-line comments (`/* ... */`) which are less likely to appear inside strings. 

**Why this works:**
- Multi-line comments (`/* */`) rarely appear in string literals
- Single-line comments (`//`) frequently appear in URLs (http://, amqps://, etc.)
- The tradeoff: We might get false positives from commented code, but we won't miss real security issues

**Proper solution (for future):** Use a full JavaScript parser (like @babel/parser) to understand the code structure and only remove actual comments, not strings containing `//`.

## Documentation Added

Comprehensive documentation was added to all parser files to explain:

### src/parsers/codeParser.js
- **How regex patterns work** - Detailed breakdown of each regex character and what it matches
- **Why each security check matters** - Explanation of the security risks
- **How line number tracking works** - Explanation of the `getLineNumber()` function
- **Examples of what each pattern matches**

### src/parsers/composeParser.js
- **What the function analyzes** - Docker Compose security issues
- **How line number tracking works** - The `findLineNumber()` helper function
- **What each security check does** - Root containers, default credentials, plaintext connections

### src/scanner.js
- **How the scanner orchestrates the process** - Step-by-step workflow
- **How glob patterns work** - Explanation of `**/*` pattern
- **How file routing works** - Which parser handles which file type
- **How output formatting works** - Grouping, sorting, and color-coding
- **What each color means** - Red (high), Yellow (medium), Green (low)

## Regex Patterns Explained

### Pattern 1: AMQP Detection
```regex
/amqp:\/\/[^\s'")]+/g
```
- `amqp:` - Literal text
- `\/\/` - Two forward slashes (escaped)
- `[^\s'")]+` - One or more chars that are NOT whitespace, quotes, or closing paren
- `g` - Global flag (find all matches)

### Pattern 2: HTTP Detection
```regex
/\bhttp:\/\/[^\s'")]+/g
```
- `\b` - Word boundary (prevents matching "https://")
- `http:` - Literal text
- `\/\/` - Two forward slashes
- `[^\s'")]+` - One or more chars that are NOT whitespace, quotes, or closing paren
- `g` - Global flag

### Pattern 3: Hardcoded Secrets
```regex
/['"]?(password|secret|key)['"]?\s*[:=]\s*['"][A-Za-z0-9]{8,}['"]?/gi
```
- `['"]?` - Optional quote
- `(password|secret|key)` - Match any of these words
- `['"]?` - Optional quote
- `\s*` - Zero or more whitespace
- `[:=]` - Colon or equals sign
- `\s*` - Zero or more whitespace
- `['"]` - Opening quote
- `[A-Za-z0-9]{8,}` - At least 8 alphanumeric characters
- `['"]?` - Optional closing quote
- `g` - Global flag
- `i` - Case-insensitive flag

## Testing

To test the scanner:
```bash
cd /home/yousef/dev/bachelor/microsec-scan
node bin/microsec-scan.js -p /home/yousef/dev/E-commerce --format console --verbose
```

Expected results:
- Should find 32+ issues (22 from docker-compose.yml + 10+ from JS files)
- All findings should show actual line numbers, not "line ?"
- Verbose mode should show which files are being analyzed

## Key Concepts for Understanding the Code

### 1. Regular Expressions (Regex)
Regex is a pattern-matching language. Think of it like a search query with superpowers:
- `.` matches any character
- `*` means "zero or more of the previous thing"
- `+` means "one or more of the previous thing"
- `[abc]` matches any of a, b, or c
- `[^abc]` matches anything EXCEPT a, b, or c
- `\s` matches whitespace (space, tab, newline)
- `\b` matches a word boundary

### 2. Glob Patterns
Glob is a file-matching pattern:
- `*` matches any characters in a filename
- `**` matches any number of directories
- `*.js` matches all JavaScript files
- `**/node_modules/**` matches node_modules at any depth

### 3. Array Spread Operator (`...`)
```javascript
findings.push(...analyzeSource(file));
```
The `...` spreads an array into individual elements. This is equivalent to:
```javascript
const results = analyzeSource(file);
for (const result of results) {
  findings.push(result);
}
```

### 4. Reduce Function
```javascript
const grouped = findings.reduce((acc, f) => {
  acc[f.file] = acc[f.file] || [];
  acc[f.file].push(f);
  return acc;
}, {});
```
`reduce()` transforms an array into a single value (in this case, an object). It:
1. Starts with an empty object `{}`
2. For each finding, adds it to the array for that file
3. Returns the accumulated object

This groups findings by file path.
