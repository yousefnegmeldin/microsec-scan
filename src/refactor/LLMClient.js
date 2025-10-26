/**
 * LLM Client for generating security fixes using multiple providers
 * Supports: Groq, OpenRouter, Together AI, OpenAI, Anthropic
 */

import Groq from 'groq-sdk';
import OpenAI from 'openai';
import chalk from 'chalk';
import path from 'path';

export class LLMClient {
  constructor(apiKey, options = {}) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    this.provider = options.provider || 'groq';
    this.apiKey = apiKey;
    this.temperature = options.temperature || 0.1;
    this.maxTokens = options.maxTokens || 8000;
    this.verbose = options.verbose || false;
    
    // Initialize the appropriate client based on provider
    this.initializeProvider(apiKey, options);
  }

  initializeProvider(apiKey, options) {
    switch (this.provider) {
      case 'groq':
        this.client = new Groq({ apiKey });
        this.model = options.model || 'llama-3.3-70b-versatile';
        this.costPer1M = 0.59;
        break;
        
      case 'openrouter':
        this.client = new OpenAI({ 
          apiKey,
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'https://github.com/yousef/microsec-scan',
            'X-Title': 'MicroSec-Scan Security Fixer'
          }
        });
        // Use paid version - much faster! (~$0.59/1M tokens, same as Groq)
        this.model = options.model || 'meta-llama/llama-3.3-70b-instruct';
        this.costPer1M = 0.59;
        break;
        
      case 'together':
        this.client = new OpenAI({ 
          apiKey,
          baseURL: 'https://api.together.xyz/v1'
        });
        this.model = options.model || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo';
        this.costPer1M = 0.88;
        break;
        
      case 'openai':
        this.client = new OpenAI({ apiKey });
        this.model = options.model || 'gpt-4o-mini';
        this.costPer1M = 0.15; // Input cost
        break;
        
      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  /**
   * Generate fixes for multiple vulnerabilities in the same file (BATCHED)
   */
  async generateBatchFixes(findings, codeContext) {
    const fileName = path.basename(codeContext.filePath);
    
    if (this.verbose) {
      console.log(chalk.gray(`  🤖 Generating ${findings.length} fixes for ${fileName}...`));
    }

    const prompt = this.buildBatchPrompt(findings, codeContext);
    const systemPrompt = this.getSystemPrompt();
    
    // Calculate approximate input tokens
    const estimatedInputTokens = Math.ceil((systemPrompt.length + prompt.length) / 4);
    
    if (this.verbose) {
      console.log(chalk.gray(`     📤 API Call → ${this.model}`));
      console.log(chalk.gray(`     📊 Est. input: ~${estimatedInputTokens.toLocaleString()} tokens`));
    }
    
    const startTime = Date.now();
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const result = this.parseBatchResponse(response.choices[0].message.content, findings, codeContext);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const usage = response.usage;
      const cost = this.calculateCost(usage?.total_tokens || 0);
      
      if (this.verbose) {
        console.log(chalk.green(`  ✓ Generated ${result.length} fixes`));
        console.log(chalk.gray(`     ⏱️  Duration: ${duration}s`));
        console.log(chalk.gray(`     📊 Tokens: ${usage?.prompt_tokens || 0} in + ${usage?.completion_tokens || 0} out = ${usage?.total_tokens || 0} total`));
        console.log(chalk.gray(`     💰 Cost: $${cost}`));
      }

      return {
        fixes: result,
        tokensUsed: usage?.total_tokens || 0
      };
    } catch (error) {
      console.error(chalk.red(`  ✗ Failed to generate batch fixes: ${error.message}`));
      throw error;
    }
  }

  /**
   * Generate a fix for a security vulnerability (single)
   */
  async generateFix(finding, codeContext) {
    if (this.verbose) {
      console.log(chalk.gray(`  🤖 Generating fix for ${finding.rule}...`));
    }

    const prompt = this.buildPrompt(finding, codeContext);
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt }
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const fixedCode = this.extractCode(response.choices[0].message.content);
      
      if (this.verbose) {
        console.log(chalk.green(`  ✓ Fix generated`));
      }

      return {
        code: fixedCode,
        explanation: response.choices[0].message.content,
        confidence: this.calculateConfidence(fixedCode, codeContext.code),
        model: this.model,
        tokensUsed: response.usage?.total_tokens || 0
      };
    } catch (error) {
      console.error(chalk.red(`  ✗ Failed to generate fix: ${error.message}`));
      throw error;
    }
  }

  /**
   * System prompt for the LLM
   */
  getSystemPrompt() {
    return `You are a security expert specializing in Node.js microservices.
Your task is to fix security vulnerabilities while:
1. Preserving existing functionality
2. Following the framework's idioms (Express/NestJS/Fastify)
3. Adding minimal code changes
4. Including necessary imports at the top
5. Maintaining existing code style and formatting

Output ONLY the fixed code block in markdown format without additional explanations.
Use \`\`\`javascript for JavaScript/TypeScript code.`;
  }

  /**
   * Build batch prompt for multiple vulnerabilities in one file
   */
  buildBatchPrompt(findings, context) {
    let prompt = `Fix multiple security vulnerabilities in this file:

**File:** ${context.filePath}

**Current Code:**
\`\`\`javascript
${context.fullFile || context.code}
\`\`\`

**Issues to Fix:**

`;

    findings.forEach((finding, index) => {
      const guidance = this.getFixGuidance(finding.rule);
      prompt += `${index + 1}. **${finding.rule}** (${finding.severity})
   - Description: ${finding.message}
   - Line: ${finding.line || 'N/A'}
   - Fix: ${guidance}

`;
    });

    prompt += `
Provide the complete fixed file that addresses ALL issues above.
Include all necessary imports and dependencies.
Maintain the existing code structure and style.
Return ONLY the complete fixed code in a single code block.`;

    return prompt;
  }

  /**
   * Build the user prompt with context (single vulnerability)
   */
  buildPrompt(finding, context) {
    const guidance = this.getFixGuidance(finding.rule);
    
    return `Fix this security vulnerability:

**Issue:** ${finding.rule}
**Description:** ${finding.message}
**Severity:** ${finding.severity}
**File:** ${context.filePath}
**Lines:** ${context.startLine}-${context.endLine}

**Current Code:**
\`\`\`javascript
${context.code}
\`\`\`

${context.fullFile ? `**Full File Context (for imports):**
\`\`\`javascript
${context.fullFile}
\`\`\`
` : ''}

**Fix Requirements:**
${guidance}

Provide the complete fixed version of the code section (lines ${context.startLine}-${context.endLine}).
Include any new imports or dependencies needed.
Maintain the same code structure and style.`;
  }

  /**
   * Get detailed fix guidance for each rule
   */
  getFixGuidance(rule) {
    const guidance = {
      'MISSING_HELMET': `Add helmet middleware to protect against common web vulnerabilities.
- Install: npm install helmet
- Import: const helmet = require('helmet') or import helmet from 'helmet'
- Use: app.use(helmet())`,

      'MISSING_RATE_LIMITING': `Add rate limiting to prevent abuse.
- Install: npm install express-rate-limit
- Import: const rateLimit = require('express-rate-limit')
- Configure with reasonable limits (e.g., 100 requests per 15 minutes)`,

      'PERMISSIVE_CORS': `Restrict CORS to specific origins instead of '*'.
- Replace cors({origin: '*'}) with specific domains
- Example: cors({origin: ['https://yourdomain.com', 'https://api.yourdomain.com']})`,

      'MISSING_AUTHENTICATION': `Add JWT authentication middleware.
- Ensure JWT verification middleware is used
- Protect sensitive routes with authentication`,

      'HARDCODED_SECRET': `Move hardcoded secrets to environment variables.
- Replace hardcoded values with process.env.VARIABLE_NAME
- Add dotenv if not already used
- Example: const secret = process.env.JWT_SECRET`,

      'PLAINTEXT_BROKER': `Enable TLS for RabbitMQ connections.
- Replace amqp:// with amqps://
- Use environment variable for connection string
- Example: const url = process.env.RABBITMQ_URL || 'amqps://...'`,

      'INSECURE_HTTP': `Use HTTPS instead of HTTP for external connections.
- Replace http:// with https://
- Ensure external API calls use secure connections`,

      'MISSING_BODY_SIZE_LIMIT': `Add body size limits to prevent large payload attacks.
- For Express: app.use(express.json({ limit: '1mb' }))
- For body-parser: bodyParser.json({ limit: '1mb' })`,

      'UNPROTECTED_ROUTE': `Add authentication middleware to this route.
- Use JWT auth middleware or guards
- Example: router.post('/sensitive', authMiddleware, handler)`,

      'NESTJS_MISSING_GUARDS': `Add authentication guards to controllers.
- Use @UseGuards(JwtAuthGuard) decorator
- Import from @nestjs/passport`,

      'NESTJS_MISSING_VALIDATION_PIPE': `Add ValidationPipe for input validation.
- In main.ts: app.useGlobalPipes(new ValidationPipe())
- Use class-validator decorators in DTOs`,

      'NESTJS_MISSING_HELMET': `Configure helmet in NestJS main.ts.
- Import helmet from 'helmet'
- Add: app.use(helmet()) before app.listen()`,

      'FASTIFY_MISSING_HELMET': `Register @fastify/helmet plugin.
- Install: npm install @fastify/helmet
- Register: await fastify.register(helmet)`,

      'FASTIFY_MISSING_RATE_LIMIT': `Register @fastify/rate-limit plugin.
- Install: npm install @fastify/rate-limit
- Configure with appropriate limits`,
    };

    return guidance[rule] || 'Apply security best practices to fix this vulnerability.';
  }

  /**
   * Parse batch response into individual fixes
   */
  parseBatchResponse(response, findings, context) {
    const fixedCode = this.extractCode(response);
    
    // Since we're getting one fixed file for all issues,
    // create a fix for each finding pointing to the same fixed file
    return findings.map(finding => ({
      code: fixedCode,
      explanation: `Fixed ${finding.rule} as part of batch fix`,
      confidence: this.calculateConfidence(fixedCode, context.code || context.fullFile),
      model: this.model
    }));
  }

  /**
   * Extract code from LLM response
   */
  extractCode(response) {
    // Try to extract code from markdown code blocks
    const codeBlockMatch = response.match(/```(?:javascript|typescript|js|ts)?\n([\s\S]+?)```/);
    
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    
    // If no code block, return the whole response trimmed
    return response.trim();
  }

  /**
   * Calculate confidence based on code similarity and completeness
   */
  calculateConfidence(fixedCode, originalCode) {
    // Simple heuristics for confidence
    if (!fixedCode || fixedCode.length < 10) return 'low';
    if (fixedCode === originalCode) return 'low';
    if (fixedCode.includes('TODO') || fixedCode.includes('FIXME')) return 'medium';
    
    // If code has proper structure (imports, uses, etc.)
    const hasImports = fixedCode.includes('import') || fixedCode.includes('require');
    const hasProperUse = fixedCode.includes('app.use') || fixedCode.includes('fastify.register') || fixedCode.includes('@UseGuards');
    
    if (hasImports && hasProperUse) return 'high';
    if (hasImports || hasProperUse) return 'medium';
    
    return 'medium';
  }

  /**
   * Calculate API cost based on token usage
   */
  calculateCost(tokens) {
    const cost = (tokens / 1000000) * this.costPer1M;
    return cost.toFixed(6);
  }
}
