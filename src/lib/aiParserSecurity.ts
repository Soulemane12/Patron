/**
 * Security and Privacy Module for AI Data Parser
 * Handles data sanitization, PII protection, and secure AI API calls
 */

import crypto from 'crypto';

export interface SecurityConfig {
  enablePIIDetection: boolean;
  enableDataSanitization: boolean;
  enableAuditLogging: boolean;
  maxDataSize: number; // bytes
  allowedDataTypes: string[];
  encryptionKey?: string;
  retentionDays: number;
}

export interface PIIDetectionResult {
  hasPII: boolean;
  piiTypes: string[];
  sensitiveFields: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  sanitizedData?: string;
}

export interface AuditLog {
  timestamp: Date;
  action: string;
  dataHash: string;
  userAgent?: string;
  ipAddress?: string;
  processingTime: number;
  tokenCount: number;
  success: boolean;
  errors?: string[];
}

export class AIParserSecurity {
  private config: SecurityConfig;
  private auditLogs: AuditLog[] = [];

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enablePIIDetection: true,
      enableDataSanitization: true,
      enableAuditLogging: true,
      maxDataSize: 1024 * 1024, // 1MB
      allowedDataTypes: ['text/plain', 'text/csv', 'application/json'],
      retentionDays: 30,
      ...config
    };
  }

  /**
   * Comprehensive security validation before AI processing
   */
  async validateSecurityRequirements(
    data: string,
    userContext?: { userAgent?: string; ipAddress?: string }
  ): Promise<{
    isValid: boolean;
    sanitizedData: string;
    warnings: string[];
    errors: string[];
    piiAnalysis: PIIDetectionResult;
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let sanitizedData = data;

    try {
      // 1. Data size validation
      if (data.length > this.config.maxDataSize) {
        errors.push(`Data size exceeds limit: ${data.length} > ${this.config.maxDataSize} bytes`);
        return {
          isValid: false,
          sanitizedData: '',
          warnings,
          errors,
          piiAnalysis: { hasPII: false, piiTypes: [], sensitiveFields: [], riskLevel: 'LOW' }
        };
      }

      // 2. PII Detection and Risk Assessment
      const piiAnalysis = this.config.enablePIIDetection
        ? await this.detectPII(data)
        : { hasPII: false, piiTypes: [], sensitiveFields: [], riskLevel: 'LOW' as const };

      if (piiAnalysis.riskLevel === 'HIGH') {
        warnings.push(`High-risk PII detected: ${piiAnalysis.piiTypes.join(', ')}`);
      }

      // 3. Data Sanitization
      if (this.config.enableDataSanitization) {
        sanitizedData = this.sanitizeData(data, piiAnalysis);
        if (sanitizedData !== data) {
          warnings.push('Data has been sanitized to remove sensitive information');
        }
      }

      // 4. Content Security Validation
      const contentValidation = this.validateContent(sanitizedData);
      if (!contentValidation.isValid) {
        errors.push(...contentValidation.errors);
      }

      // 5. Audit Logging
      if (this.config.enableAuditLogging) {
        this.logSecurityEvent({
          timestamp: new Date(),
          action: 'security_validation',
          dataHash: this.hashData(data),
          userAgent: userContext?.userAgent,
          ipAddress: userContext?.ipAddress,
          processingTime: 0,
          tokenCount: 0,
          success: errors.length === 0,
          errors: errors.length > 0 ? errors : undefined
        });
      }

      return {
        isValid: errors.length === 0,
        sanitizedData,
        warnings,
        errors,
        piiAnalysis
      };

    } catch (error) {
      errors.push(`Security validation failed: ${error}`);
      return {
        isValid: false,
        sanitizedData: '',
        warnings,
        errors,
        piiAnalysis: { hasPII: false, piiTypes: [], sensitiveFields: [], riskLevel: 'LOW' }
      };
    }
  }

  /**
   * Detect Personally Identifiable Information (PII)
   */
  private async detectPII(data: string): Promise<PIIDetectionResult> {
    const piiTypes: string[] = [];
    const sensitiveFields: string[] = [];
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    // Pattern-based PII detection
    const piiPatterns = {
      EMAIL: {
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
        risk: 'MEDIUM'
      },
      PHONE: {
        pattern: /(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{10})/g,
        risk: 'MEDIUM'
      },
      SSN: {
        pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
        risk: 'HIGH'
      },
      CREDIT_CARD: {
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        risk: 'HIGH'
      },
      ADDRESS: {
        pattern: /\b\d+\s+[A-Za-z\s]+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln)\b/gi,
        risk: 'LOW'
      },
      DATE_OF_BIRTH: {
        pattern: /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/g,
        risk: 'HIGH'
      },
      IP_ADDRESS: {
        pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        risk: 'MEDIUM'
      }
    };

    // Check for each PII type
    for (const [type, config] of Object.entries(piiPatterns)) {
      const matches = data.match(config.pattern);
      if (matches && matches.length > 0) {
        piiTypes.push(type);
        sensitiveFields.push(...matches.slice(0, 3)); // Limit to first 3 matches

        // Update risk level
        if (config.risk === 'HIGH') {
          riskLevel = 'HIGH';
        } else if (config.risk === 'MEDIUM' && riskLevel !== 'HIGH') {
          riskLevel = 'MEDIUM';
        }
      }
    }

    // Additional contextual analysis
    const hasPII = piiTypes.length > 0;

    // Check for medical or financial keywords that increase risk
    const highRiskKeywords = [
      'medical', 'health', 'diagnosis', 'treatment', 'medication',
      'bank', 'account', 'routing', 'financial', 'income', 'salary'
    ];

    const hasHighRiskKeywords = highRiskKeywords.some(keyword =>
      data.toLowerCase().includes(keyword)
    );

    if (hasHighRiskKeywords && hasPII) {
      riskLevel = 'HIGH';
    }

    return {
      hasPII,
      piiTypes,
      sensitiveFields: [...new Set(sensitiveFields)], // Remove duplicates
      riskLevel
    };
  }

  /**
   * Sanitize data by removing or masking sensitive information
   */
  private sanitizeData(data: string, piiAnalysis: PIIDetectionResult): string {
    let sanitized = data;

    // Only sanitize if PII is detected and risk is MEDIUM or HIGH
    if (!piiAnalysis.hasPII || piiAnalysis.riskLevel === 'LOW') {
      return sanitized;
    }

    // Sanitization patterns
    const sanitizationPatterns = {
      EMAIL: {
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
        replacement: (match: string) => {
          const [local, domain] = match.split('@');
          const maskedLocal = local.length > 2
            ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
            : local;
          return `${maskedLocal}@${domain}`;
        }
      },
      PHONE: {
        pattern: /(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{10})/g,
        replacement: () => 'XXX-XXX-XXXX'
      },
      SSN: {
        pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
        replacement: () => 'XXX-XX-XXXX'
      },
      CREDIT_CARD: {
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        replacement: () => 'XXXX-XXXX-XXXX-XXXX'
      },
      IP_ADDRESS: {
        pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        replacement: () => 'XXX.XXX.XXX.XXX'
      }
    };

    // Apply sanitization only for detected PII types
    for (const piiType of piiAnalysis.piiTypes) {
      const sanitizer = sanitizationPatterns[piiType as keyof typeof sanitizationPatterns];
      if (sanitizer) {
        if (typeof sanitizer.replacement === 'function') {
          sanitized = sanitized.replace(sanitizer.pattern, sanitizer.replacement as any);
        } else {
          sanitized = sanitized.replace(sanitizer.pattern, sanitizer.replacement);
        }
      }
    }

    return sanitized;
  }

  /**
   * Validate content for malicious patterns or inappropriate data
   */
  private validateContent(data: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for potentially malicious content
    const maliciousPatterns = [
      /(<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>)/gi, // JavaScript
      /(javascript:|data:|vbscript:)/gi, // Protocol injections
      /(\${.*}|<%.*%>|{{.*}})/g, // Template injections
      /(DROP\s+TABLE|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+.*SET)/gi, // SQL injection attempts
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(data)) {
        errors.push('Potentially malicious content detected');
        break;
      }
    }

    // Check for excessively long lines (potential DoS)
    const lines = data.split('\n');
    const maxLineLength = 10000;
    const hasLongLines = lines.some(line => line.length > maxLineLength);
    if (hasLongLines) {
      errors.push(`Lines exceed maximum length of ${maxLineLength} characters`);
    }

    // Check for excessive special characters (potential encoding attack)
    const specialCharRatio = (data.match(/[^\x20-\x7E\n\r\t]/g) || []).length / data.length;
    if (specialCharRatio > 0.1) {
      errors.push('Excessive special characters detected');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Encrypt sensitive data for storage
   */
  encryptData(data: string): { encrypted: string; iv: string } {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.config.encryptionKey);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encrypted,
      iv: iv.toString('hex')
    };
  }

  /**
   * Decrypt sensitive data from storage
   */
  decryptData(encryptedData: string, iv: string): string {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const decipher = crypto.createDecipher('aes-256-cbc', this.config.encryptionKey);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hash data for audit trails without storing sensitive content
   */
  private hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Log security events for audit trail
   */
  private logSecurityEvent(event: AuditLog): void {
    this.auditLogs.push(event);

    // Cleanup old logs based on retention policy
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    this.auditLogs = this.auditLogs.filter(log => log.timestamp >= cutoffDate);

    // In production, you would send this to a secure logging service
    if (process.env.NODE_ENV === 'development') {
      console.log('[Security Audit]', {
        action: event.action,
        timestamp: event.timestamp.toISOString(),
        success: event.success,
        dataHash: event.dataHash
      });
    }
  }

  /**
   * Get audit logs for compliance reporting
   */
  getAuditLogs(startDate?: Date, endDate?: Date): AuditLog[] {
    let logs = this.auditLogs;

    if (startDate) {
      logs = logs.filter(log => log.timestamp >= startDate);
    }

    if (endDate) {
      logs = logs.filter(log => log.timestamp <= endDate);
    }

    return logs;
  }

  /**
   * Generate security compliance report
   */
  generateComplianceReport(): {
    totalEvents: number;
    securityViolations: number;
    piiDetections: number;
    lastAuditDate: Date | null;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    recommendations: string[];
  } {
    const totalEvents = this.auditLogs.length;
    const securityViolations = this.auditLogs.filter(log => !log.success).length;
    const piiDetections = this.auditLogs.filter(log =>
      log.action === 'security_validation' && log.success
    ).length;

    const lastAuditDate = this.auditLogs.length > 0
      ? new Date(Math.max(...this.auditLogs.map(log => log.timestamp.getTime())))
      : null;

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    const recommendations: string[] = [];

    // Risk assessment
    const violationRate = totalEvents > 0 ? securityViolations / totalEvents : 0;

    if (violationRate > 0.1) {
      riskLevel = 'HIGH';
      recommendations.push('High security violation rate detected - review access controls');
    } else if (violationRate > 0.05) {
      riskLevel = 'MEDIUM';
      recommendations.push('Moderate security violations - consider additional monitoring');
    }

    if (piiDetections > 10) {
      if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
      recommendations.push('High volume of PII processing - ensure data protection compliance');
    }

    if (!this.config.enableAuditLogging) {
      recommendations.push('Audit logging is disabled - enable for compliance');
    }

    if (!this.config.enablePIIDetection) {
      recommendations.push('PII detection is disabled - enable for data protection');
    }

    return {
      totalEvents,
      securityViolations,
      piiDetections,
      lastAuditDate,
      riskLevel,
      recommendations
    };
  }
}

// Export security presets
export const SECURITY_PRESETS = {
  PERMISSIVE: {
    enablePIIDetection: false,
    enableDataSanitization: false,
    enableAuditLogging: true,
    maxDataSize: 5 * 1024 * 1024, // 5MB
    retentionDays: 7
  },
  STANDARD: {
    enablePIIDetection: true,
    enableDataSanitization: true,
    enableAuditLogging: true,
    maxDataSize: 1024 * 1024, // 1MB
    retentionDays: 30
  },
  STRICT: {
    enablePIIDetection: true,
    enableDataSanitization: true,
    enableAuditLogging: true,
    maxDataSize: 512 * 1024, // 512KB
    retentionDays: 90
  }
} as const;

// Export factory function
export function createSecurityModule(preset?: keyof typeof SECURITY_PRESETS): AIParserSecurity {
  const config = preset ? SECURITY_PRESETS[preset] : SECURITY_PRESETS.STANDARD;
  return new AIParserSecurity(config);
}