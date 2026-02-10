import { message, showMessage } from '../message';
import { toast } from 'sonner';

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

describe('Message Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('message API', () => {
    it('should call toast.success with message', () => {
      message.success('Success message');
      expect(toast.success).toHaveBeenCalledWith('Success message');
    });

    it('should call toast.error with message', () => {
      message.error('Error message');
      expect(toast.error).toHaveBeenCalledWith('Error message');
    });

    it('should call toast.warning with message', () => {
      message.warning('Warning message');
      expect(toast.warning).toHaveBeenCalledWith('Warning message');
    });

    it('should call toast.info with message', () => {
      message.info('Info message');
      expect(toast.info).toHaveBeenCalledWith('Info message');
    });
  });

  describe('message API with duration (antd compatibility)', () => {
    it('should call toast.success with duration in milliseconds', () => {
      message.success('Success message', 3);
      expect(toast.success).toHaveBeenCalledWith('Success message', { duration: 3000 });
    });

    it('should call toast.error with duration in milliseconds', () => {
      message.error('Error message', 5);
      expect(toast.error).toHaveBeenCalledWith('Error message', { duration: 5000 });
    });

    it('should call toast.warning with duration in milliseconds', () => {
      message.warning('Warning message', 2);
      expect(toast.warning).toHaveBeenCalledWith('Warning message', { duration: 2000 });
    });

    it('should call toast.info with duration in milliseconds', () => {
      message.info('Info message', 10);
      expect(toast.info).toHaveBeenCalledWith('Info message', { duration: 10000 });
    });
  });

  describe('showMessage API (alias)', () => {
    it('should call toast.success with message', () => {
      showMessage.success('Success message');
      expect(toast.success).toHaveBeenCalledWith('Success message');
    });

    it('should call toast.error with message', () => {
      showMessage.error('Error message');
      expect(toast.error).toHaveBeenCalledWith('Error message');
    });

    it('should call toast.warning with message', () => {
      showMessage.warning('Warning message');
      expect(toast.warning).toHaveBeenCalledWith('Warning message');
    });

    it('should call toast.info with message', () => {
      showMessage.info('Info message');
      expect(toast.info).toHaveBeenCalledWith('Info message');
    });
  });
});
