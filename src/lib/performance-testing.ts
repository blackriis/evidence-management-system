import { performance } from 'perf_hooks';

// Performance test configuration
export interface PerformanceTestConfig {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  expectedStatusCode?: number;
  maxResponseTime?: number;
  concurrentUsers?: number;
  testDuration?: number; // in seconds
  rampUpTime?: number; // in seconds
}

// Performance test result
export interface PerformanceTestResult {
  testName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  errors: Array<{ message: string; count: number }>;
  testDuration: number;
  passed: boolean;
}

// Individual request result
interface RequestResult {
  duration: number;
  statusCode: number;
  error?: string;
}

export class PerformanceTester {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.APP_URL || 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  // Run a single performance test
  async runTest(config: PerformanceTestConfig): Promise<PerformanceTestResult> {
    console.log(`Starting performance test: ${config.name}`);
    
    const startTime = performance.now();
    const results: RequestResult[] = [];
    const errors: Map<string, number> = new Map();
    
    const {
      concurrentUsers = 10,
      testDuration = 60,
      rampUpTime = 10,
      maxResponseTime = 2000,
      expectedStatusCode = 200,
    } = config;

    // Calculate request intervals
    const totalRequests = concurrentUsers * testDuration;
    const requestInterval = (testDuration * 1000) / totalRequests;
    const rampUpInterval = (rampUpTime * 1000) / concurrentUsers;

    // Start concurrent users with ramp-up
    const userPromises: Promise<void>[] = [];
    
    for (let i = 0; i < concurrentUsers; i++) {
      const userDelay = i * rampUpInterval;
      const userPromise = this.simulateUser(
        config,
        testDuration,
        requestInterval,
        userDelay,
        results,
        errors
      );
      userPromises.push(userPromise);
    }

    // Wait for all users to complete
    await Promise.all(userPromises);

    const endTime = performance.now();
    const actualTestDuration = (endTime - startTime) / 1000;

    // Calculate statistics
    const durations = results.map(r => r.duration).sort((a, b) => a - b);
    const successfulRequests = results.filter(r => r.statusCode === expectedStatusCode);
    const failedRequests = results.filter(r => r.statusCode !== expectedStatusCode);

    const result: PerformanceTestResult = {
      testName: config.name,
      totalRequests: results.length,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      averageResponseTime: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      minResponseTime: durations.length > 0 ? durations[0] : 0,
      maxResponseTime: durations.length > 0 ? durations[durations.length - 1] : 0,
      p50ResponseTime: durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0,
      p95ResponseTime: durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0,
      p99ResponseTime: durations.length > 0 ? durations[Math.floor(durations.length * 0.99)] : 0,
      requestsPerSecond: results.length / actualTestDuration,
      errorRate: results.length > 0 ? failedRequests.length / results.length : 0,
      errors: Array.from(errors.entries()).map(([message, count]) => ({ message, count })),
      testDuration: actualTestDuration,
      passed: this.evaluateTestResult(result, config),
    };

    console.log(`Performance test completed: ${config.name}`);
    console.log(`- Total requests: ${result.totalRequests}`);
    console.log(`- Success rate: ${((1 - result.errorRate) * 100).toFixed(2)}%`);
    console.log(`- Average response time: ${result.averageResponseTime.toFixed(2)}ms`);
    console.log(`- P95 response time: ${result.p95ResponseTime.toFixed(2)}ms`);
    console.log(`- Requests per second: ${result.requestsPerSecond.toFixed(2)}`);
    console.log(`- Test passed: ${result.passed ? 'YES' : 'NO'}`);

    return result;
  }

  // Simulate a single user making requests
  private async simulateUser(
    config: PerformanceTestConfig,
    testDuration: number,
    requestInterval: number,
    initialDelay: number,
    results: RequestResult[],
    errors: Map<string, number>
  ): Promise<void> {
    // Wait for ramp-up delay
    if (initialDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, initialDelay));
    }

    const endTime = Date.now() + (testDuration * 1000);
    
    while (Date.now() < endTime) {
      try {
        const result = await this.makeRequest(config);
        results.push(result);
        
        if (result.error) {
          const errorCount = errors.get(result.error) || 0;
          errors.set(result.error, errorCount + 1);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCount = errors.get(errorMessage) || 0;
        errors.set(errorMessage, errorCount + 1);
        
        results.push({
          duration: 0,
          statusCode: 0,
          error: errorMessage,
        });
      }

      // Wait before next request
      await new Promise(resolve => setTimeout(resolve, requestInterval));
    }
  }

  // Make a single HTTP request
  private async makeRequest(config: PerformanceTestConfig): Promise<RequestResult> {
    const startTime = performance.now();
    
    try {
      const url = config.url.startsWith('http') ? config.url : `${this.baseUrl}${config.url}`;
      
      const response = await fetch(url, {
        method: config.method,
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      return {
        duration,
        statusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      return {
        duration,
        statusCode: 0,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Evaluate if test passed based on criteria
  private evaluateTestResult(result: PerformanceTestResult, config: PerformanceTestConfig): boolean {
    const criteria = [
      // Error rate should be less than 5%
      result.errorRate < 0.05,
      // P95 response time should be under threshold
      result.p95ResponseTime < (config.maxResponseTime || 2000),
      // At least 90% of requests should be successful
      result.successfulRequests / result.totalRequests >= 0.9,
    ];

    return criteria.every(criterion => criterion);
  }

  // Run multiple tests in sequence
  async runTestSuite(configs: PerformanceTestConfig[]): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = [];
    
    for (const config of configs) {
      const result = await this.runTest(config);
      results.push(result);
      
      // Wait between tests to avoid interference
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return results;
  }

  // Generate performance test report
  generateReport(results: PerformanceTestResult[]): string {
    const passedTests = results.filter(r => r.passed);
    const failedTests = results.filter(r => r.passed === false);

    let report = '# Performance Test Report\n\n';
    report += `**Test Summary:**\n`;
    report += `- Total tests: ${results.length}\n`;
    report += `- Passed: ${passedTests.length}\n`;
    report += `- Failed: ${failedTests.length}\n`;
    report += `- Success rate: ${((passedTests.length / results.length) * 100).toFixed(2)}%\n\n`;

    report += '## Test Results\n\n';
    
    results.forEach(result => {
      report += `### ${result.testName} ${result.passed ? '✅' : '❌'}\n\n`;
      report += `- **Total Requests:** ${result.totalRequests}\n`;
      report += `- **Success Rate:** ${((1 - result.errorRate) * 100).toFixed(2)}%\n`;
      report += `- **Average Response Time:** ${result.averageResponseTime.toFixed(2)}ms\n`;
      report += `- **P95 Response Time:** ${result.p95ResponseTime.toFixed(2)}ms\n`;
      report += `- **P99 Response Time:** ${result.p99ResponseTime.toFixed(2)}ms\n`;
      report += `- **Requests per Second:** ${result.requestsPerSecond.toFixed(2)}\n`;
      report += `- **Test Duration:** ${result.testDuration.toFixed(2)}s\n`;
      
      if (result.errors.length > 0) {
        report += `- **Errors:**\n`;
        result.errors.forEach(error => {
          report += `  - ${error.message}: ${error.count} occurrences\n`;
        });
      }
      
      report += '\n';
    });

    return report;
  }
}

// Predefined test configurations for common scenarios
export const defaultTestConfigs: PerformanceTestConfig[] = [
  {
    name: 'API Health Check',
    url: '/api/health',
    method: 'GET',
    maxResponseTime: 100,
    concurrentUsers: 5,
    testDuration: 30,
  },
  {
    name: 'Dashboard Metrics Load Test',
    url: '/api/dashboard/metrics',
    method: 'GET',
    maxResponseTime: 1000,
    concurrentUsers: 20,
    testDuration: 60,
    headers: {
      'Authorization': 'Bearer test-token', // Would need actual token in real tests
    },
  },
  {
    name: 'Evidence List Performance',
    url: '/api/evidence',
    method: 'GET',
    maxResponseTime: 800,
    concurrentUsers: 15,
    testDuration: 45,
  },
  {
    name: 'Indicator Tree Load Test',
    url: '/api/indicator-tree',
    method: 'GET',
    maxResponseTime: 500,
    concurrentUsers: 10,
    testDuration: 30,
  },
];

// Export singleton instance
export const performanceTester = new PerformanceTester();

// CLI function for running tests
export async function runPerformanceTests(configPath?: string): Promise<void> {
  let configs = defaultTestConfigs;
  
  if (configPath) {
    try {
      const fs = await import('fs');
      const configFile = fs.readFileSync(configPath, 'utf-8');
      configs = JSON.parse(configFile);
    } catch (error) {
      console.error(`Failed to load config file: ${error}`);
      process.exit(1);
    }
  }

  const results = await performanceTester.runTestSuite(configs);
  const report = performanceTester.generateReport(results);
  
  console.log('\n' + report);
  
  // Write report to file
  try {
    const fs = await import('fs');
    fs.writeFileSync('performance-test-report.md', report);
    console.log('Performance test report saved to: performance-test-report.md');
  } catch (error) {
    console.error('Failed to save report:', error);
  }

  // Exit with error code if any tests failed
  const failedTests = results.filter(r => !r.passed);
  if (failedTests.length > 0) {
    console.error(`\n${failedTests.length} performance tests failed!`);
    process.exit(1);
  }
}