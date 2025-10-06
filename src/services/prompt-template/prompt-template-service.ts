// src/services/prompt-template/prompt-template-service.ts

/**
 * Service for handling prompt templates with variable substitution
 */

export interface VariableMatch {
  readonly full: string;
  readonly name: string;
  readonly index: number;
}

export class PromptTemplateService {
  /**
   * Extract variables from a template string
   * Supports both {{variable}} and {variable} formats
   */
  public extractVariables(template: string): string[] {
    const regex = /\{\{(\w+)\}\}|\{(\w+)\}/g;
    const variables = new Set<string>();
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      const varName = match[1] || match[2];
      if (varName) {
        variables.add(varName);
      }
    }
    
    return Array.from(variables);
  }

  /**
   * Find all variable matches in a template with their positions
   */
  public findVariableMatches(template: string): VariableMatch[] {
    const regex = /\{\{(\w+)\}\}|\{(\w+)\}/g;
    const matches: VariableMatch[] = [];
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      const varName = match[1] || match[2];
      if (varName) {
        matches.push({
          full: match[0],
          name: varName,
          index: match.index,
        });
      }
    }
    
    return matches;
  }

  /**
   * Substitute variables in a template with provided values
   * Missing variables are left as-is
   */
  public substituteVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    let result = template;
    
    // Replace {{variable}} format
    result = result.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] !== undefined ? variables[varName] : match;
    });
    
    // Replace {variable} format
    result = result.replace(/\{(\w+)\}/g, (match, varName) => {
      return variables[varName] !== undefined ? variables[varName] : match;
    });
    
    return result;
  }

  /**
   * Build the final prompt from system message, user prompt template, and variables
   */
  public buildPrompt(
    systemMessage: string,
    userPrompt: string,
    variables: Record<string, string>
  ): { system: string; user: string } {
    return {
      system: this.substituteVariables(systemMessage, variables),
      user: this.substituteVariables(userPrompt, variables),
    };
  }

  /**
   * Validate that all required variables are provided
   */
  public validateVariables(
    template: string,
    variables: Record<string, string>
  ): { valid: boolean; missing: string[] } {
    const required = this.extractVariables(template);
    const provided = Object.keys(variables);
    const missing = required.filter(v => !provided.includes(v));
    
    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Create a default variables object from a template
   */
  public createDefaultVariables(template: string): Record<string, string> {
    const variables = this.extractVariables(template);
    return Object.fromEntries(variables.map(v => [v, '']));
  }

  /**
   * Merge variables, keeping existing values and adding new ones
   */
  public mergeVariables(
    existing: Record<string, string>,
    template: string
  ): Record<string, string> {
    const required = this.extractVariables(template);
    const merged = { ...existing };
    
    // Add missing variables with empty strings
    for (const varName of required) {
      if (merged[varName] === undefined) {
        merged[varName] = '';
      }
    }
    
    // Remove variables that are no longer in the template
    for (const varName of Object.keys(merged)) {
      if (!required.includes(varName)) {
        delete merged[varName];
      }
    }
    
    return merged;
  }
}

// Export singleton instance
export const promptTemplateService = new PromptTemplateService();