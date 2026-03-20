const ProgressReporter = require('../../../src/core/ProgressReporter');

describe('ProgressReporter', () => {
  let reporter;

  beforeEach(() => {
    // Disable console output for tests
    reporter = new ProgressReporter({ enableConsole: false });
  });

  afterEach(() => {
    if (reporter) {
      reporter.stop();
    }
  });

  describe('reportScanProgress', () => {
    it('should emit scanProgress event with correct data', (done) => {
      reporter.on('scanProgress', (data) => {
        expect(data).toEqual({
          phase: 'scan',
          processed: 5,
          total: 10,
          percentage: 50
        });
        done();
      });

      reporter.reportScanProgress(5, 10);
    });

    it('should calculate percentage correctly', (done) => {
      reporter.on('scanProgress', (data) => {
        expect(data.percentage).toBe(75);
        done();
      });

      reporter.reportScanProgress(75, 100);
    });

    it('should handle zero total gracefully', (done) => {
      reporter.on('scanProgress', (data) => {
        expect(data.percentage).toBe(0);
        done();
      });

      reporter.reportScanProgress(0, 0);
    });
  });

  describe('reportAnalysisProgress', () => {
    it('should emit analysisProgress event with correct data', (done) => {
      reporter.on('analysisProgress', (data) => {
        expect(data).toEqual({
          phase: 'analysis',
          currentFile: 'src/test.js',
          processed: 3,
          total: 10,
          percentage: 30
        });
        done();
      });

      reporter.reportAnalysisProgress('src/test.js', 3, 10);
    });

    it('should include current file being analyzed', (done) => {
      reporter.on('analysisProgress', (data) => {
        expect(data.currentFile).toBe('src/controllers/user.js');
        done();
      });

      reporter.reportAnalysisProgress('src/controllers/user.js', 1, 5);
    });

    it('should calculate percentage correctly', (done) => {
      reporter.on('analysisProgress', (data) => {
        expect(data.percentage).toBe(100);
        done();
      });

      reporter.reportAnalysisProgress('final.js', 50, 50);
    });
  });

  describe('reportPhaseCompletion', () => {
    it('should emit phaseComplete event with correct data', (done) => {
      reporter.on('phaseComplete', (data) => {
        expect(data.phase).toBe('scan');
        expect(data.duration).toBe(1500);
        expect(data.timestamp).toBeInstanceOf(Date);
        done();
      });

      reporter.reportPhaseCompletion('scan', 1500);
    });

    it('should include timestamp', (done) => {
      const beforeTime = Date.now();
      
      reporter.on('phaseComplete', (data) => {
        const afterTime = Date.now();
        expect(data.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime);
        expect(data.timestamp.getTime()).toBeLessThanOrEqual(afterTime);
        done();
      });

      reporter.reportPhaseCompletion('analysis', 2000);
    });
  });

  describe('reportOverallProgress', () => {
    it('should emit overallProgress event with correct data', (done) => {
      reporter.on('overallProgress', (data) => {
        expect(data.percentage).toBe(45);
        expect(data.timestamp).toBeInstanceOf(Date);
        done();
      });

      reporter.reportOverallProgress(45);
    });

    it('should handle 0% progress', (done) => {
      reporter.on('overallProgress', (data) => {
        expect(data.percentage).toBe(0);
        done();
      });

      reporter.reportOverallProgress(0);
    });

    it('should handle 100% progress', (done) => {
      reporter.on('overallProgress', (data) => {
        expect(data.percentage).toBe(100);
        done();
      });

      reporter.reportOverallProgress(100);
    });
  });

  describe('event-based progress reporting', () => {
    it('should support multiple event listeners', () => {
      let listener1Called = false;
      let listener2Called = false;

      reporter.on('scanProgress', () => {
        listener1Called = true;
      });

      reporter.on('scanProgress', () => {
        listener2Called = true;
      });

      reporter.reportScanProgress(1, 10);

      expect(listener1Called).toBe(true);
      expect(listener2Called).toBe(true);
    });

    it('should emit events in sequence', () => {
      const events = [];

      reporter.on('scanProgress', () => events.push('scan'));
      reporter.on('analysisProgress', () => events.push('analysis'));
      reporter.on('phaseComplete', () => events.push('complete'));

      reporter.reportScanProgress(1, 10);
      reporter.reportAnalysisProgress('test.js', 1, 10);
      reporter.reportPhaseCompletion('scan', 100);

      expect(events).toEqual(['scan', 'analysis', 'complete']);
    });
  });

  describe('stop', () => {
    it('should clear progress bars', () => {
      reporter.reportScanProgress(5, 10);
      reporter.stop();
      
      expect(reporter.progressBars.size).toBe(0);
    });

    it('should be safe to call multiple times', () => {
      reporter.stop();
      expect(() => reporter.stop()).not.toThrow();
    });
  });

  describe('console output', () => {
    it('should create progress bars when console is enabled', () => {
      const consoleReporter = new ProgressReporter({ enableConsole: true });
      
      consoleReporter.reportScanProgress(1, 10);
      
      expect(consoleReporter.progressBars.has('scan')).toBe(true);
      
      consoleReporter.stop();
    });

    it('should not create progress bars when console is disabled', () => {
      reporter.reportScanProgress(1, 10);
      
      // Progress bars map should be empty since console is disabled
      expect(reporter.progressBars.size).toBe(0);
    });
  });
});
