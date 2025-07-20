'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  Database, 
  Server, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface PerformanceData {
  timestamp: number;
  timeWindow: number;
  performance: {
    api: {
      totalRequests: number;
      averageResponseTime: number;
      p95ResponseTime: number;
      p99ResponseTime: number;
      errorRate: number;
      requestsPerMinute: number;
      topEndpoints: Array<{ endpoint: string; count: number }>;
      slowestEndpoints: Array<{ endpoint: string; averageTime: number; maxTime: number; count: number }>;
    };
    database: {
      totalQueries: number;
      averageQueryTime: number;
      slowQueries: number;
      queriesPerMinute: number;
      slowestQueries: Array<{ query: string; duration: number; timestamp: number }>;
    };
    system: {
      averageCpuUsage: number;
      averageMemoryUsage: number;
      averageCacheHitRate: number;
      peakMemoryUsage: number;
      currentConnections: number;
    };
  };
  health: {
    database: boolean;
    cache: boolean;
  };
  database?: {
    total_connections: number;
    active_connections: number;
    idle_connections: number;
  };
  system?: {
    memory: NodeJS.MemoryUsage;
    uptime: number;
    version: string;
    platform: string;
    arch: string;
  };
}

export function PerformanceDashboard() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeWindow, setTimeWindow] = useState(3600000); // 1 hour

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/performance/metrics?timeWindow=${timeWindow}&includeSystem=true`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch performance data');
      }
      
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeWindow]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, timeWindow]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getHealthStatus = (isHealthy: boolean) => (
    <Badge variant={isHealthy ? "default" : "destructive"} className="flex items-center gap-1">
      {isHealthy ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      {isHealthy ? 'Healthy' : 'Unhealthy'}
    </Badge>
  );

  const getPerformanceColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading performance data...
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load performance data: {error}
          <Button variant="outline" size="sm" onClick={fetchData} className="ml-2">
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Dashboard</h2>
          <p className="text-muted-foreground">
            System performance metrics and health monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(parseInt(e.target.value))}
            className="px-3 py-1 border rounded"
          >
            <option value={900000}>15 minutes</option>
            <option value={3600000}>1 hour</option>
            <option value={21600000}>6 hours</option>
            <option value={86400000}>24 hours</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Disable' : 'Enable'} Auto-refresh
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Health Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Health</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {getHealthStatus(data.health.database)}
              {data.database && (
                <div className="text-right text-sm text-muted-foreground">
                  <div>{data.database.active_connections} active</div>
                  <div>{data.database.total_connections} total</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Health</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {getHealthStatus(data.health.cache)}
              <div className="text-right text-sm text-muted-foreground">
                Hit Rate: {(data.performance.system.averageCacheHitRate * 100).toFixed(1)}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {data.system ? formatUptime(data.system.uptime) : 'N/A'}
            </div>
            <div className="text-sm text-muted-foreground">
              {data.system?.platform} {data.system?.arch}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics Tabs */}
      <Tabs defaultValue="api" className="space-y-4">
        <TabsList>
          <TabsTrigger value="api">API Performance</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="system">System Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.performance.api.totalRequests.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {data.performance.api.requestsPerMinute.toFixed(1)} req/min
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getPerformanceColor(data.performance.api.averageResponseTime, { good: 200, warning: 1000 })}`}>
                  {formatDuration(data.performance.api.averageResponseTime)}
                </div>
                <p className="text-xs text-muted-foreground">
                  P95: {formatDuration(data.performance.api.p95ResponseTime)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getPerformanceColor(data.performance.api.errorRate * 100, { good: 1, warning: 5 })}`}>
                  {(data.performance.api.errorRate * 100).toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Error threshold: 5%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">P99 Response Time</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getPerformanceColor(data.performance.api.p99ResponseTime, { good: 500, warning: 2000 })}`}>
                  {formatDuration(data.performance.api.p99ResponseTime)}
                </div>
                <p className="text-xs text-muted-foreground">
                  99th percentile
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top Endpoints */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Endpoints</CardTitle>
                <CardDescription>Most frequently accessed endpoints</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.performance.api.topEndpoints.map((endpoint, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-mono truncate">{endpoint.endpoint}</span>
                      <Badge variant="secondary">{endpoint.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Slowest Endpoints</CardTitle>
                <CardDescription>Endpoints with highest average response time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.performance.api.slowestEndpoints.map((endpoint, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-mono truncate">{endpoint.endpoint}</span>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{formatDuration(endpoint.averageTime)}</div>
                        <div className="text-xs text-muted-foreground">max: {formatDuration(endpoint.maxTime)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.performance.database.totalQueries.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {data.performance.database.queriesPerMinute.toFixed(1)} queries/min
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Query Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getPerformanceColor(data.performance.database.averageQueryTime, { good: 50, warning: 200 })}`}>
                  {formatDuration(data.performance.database.averageQueryTime)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Target: &lt;50ms
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Slow Queries</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.performance.database.slowQueries > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {data.performance.database.slowQueries}
                </div>
                <p className="text-xs text-muted-foreground">
                  Queries &gt;1s
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Connections</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.database?.active_connections || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.database?.idle_connections || 0} idle
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Slowest Queries */}
          {data.performance.database.slowestQueries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Slowest Queries</CardTitle>
                <CardDescription>Database queries with highest execution time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.performance.database.slowestQueries.map((query, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm font-mono truncate flex-1">{query.query}</span>
                      <div className="text-right ml-2">
                        <div className="text-sm font-semibold">{formatDuration(query.duration)}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(query.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Memory Usage</CardTitle>
                <CardDescription>Current memory consumption</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Average Usage</span>
                    <span>{(data.performance.system.averageMemoryUsage * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={data.performance.system.averageMemoryUsage * 100} />
                </div>
                {data.system && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-medium">Heap Used</div>
                      <div className="text-muted-foreground">{formatBytes(data.system.memory.heapUsed)}</div>
                    </div>
                    <div>
                      <div className="font-medium">Heap Total</div>
                      <div className="text-muted-foreground">{formatBytes(data.system.memory.heapTotal)}</div>
                    </div>
                    <div>
                      <div className="font-medium">External</div>
                      <div className="text-muted-foreground">{formatBytes(data.system.memory.external)}</div>
                    </div>
                    <div>
                      <div className="font-medium">RSS</div>
                      <div className="text-muted-foreground">{formatBytes(data.system.memory.rss)}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
                <CardDescription>CPU and cache performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>CPU Usage</span>
                    <span>{(data.performance.system.averageCpuUsage * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={data.performance.system.averageCpuUsage * 100} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Cache Hit Rate</span>
                    <span>{(data.performance.system.averageCacheHitRate * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={data.performance.system.averageCacheHitRate * 100} />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Peak Memory</div>
                    <div className="text-muted-foreground">{formatBytes(data.performance.system.peakMemoryUsage)}</div>
                  </div>
                  <div>
                    <div className="font-medium">Connections</div>
                    <div className="text-muted-foreground">{data.performance.system.currentConnections}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}