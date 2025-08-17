---
applyTo: '**'
---
Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

# Instructions for AI Agent

## Systematic Update Approach

### Step 1: Initial Scan
Run the following searches to identify all auth-related code:

1. **Import/Dependency Search**
   - Search for old auth library imports
   - Look for: `import.*auth`, `require.*auth`, `using.*auth`
   - Check package.json, pom.xml, requirements.txt, etc.

2. **Decorator/Attribute Search**
   - Search for: `@Authorize`, `@Auth`, `@Secured`, `@RequireAuth`
   - Look for custom auth decorators

3. **Middleware Search**
   - Search for: `authMiddleware`, `authenticate`, `requireAuth`
   - Check middleware registration files

### Step 2: File-by-File Updates

For each file containing old auth code:

1. **Backup the original code** (comment it out)
2. **Import new auth modules**
3. **Replace auth decorators/attributes**
4. **Update method signatures** if needed
5. **Test the specific endpoint/function**
6. **Remove commented old code** after verification

### Step 3: Pattern Replacements

Common patterns to replace:

**Old Pattern Example:**
```javascript
// Old
@RequireAuth()
async getProfile(req) {
  const userId = req.user.id;
  // ...
}