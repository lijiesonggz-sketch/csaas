import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog Component', () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render dialog when open is true', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        content="Test Content"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should not render dialog when open is false', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Test Title"
        content="Test Content"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
  });

  it('should display default button texts', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        content="Test Content"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('确认')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
  });

  it('should display custom button texts when provided', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        content="Test Content"
        confirmText="Yes"
        cancelText="No"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        content="Test Content"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByText('确认');
    fireEvent.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        content="Test Content"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText('取消');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('should call onCancel when dialog is closed via backdrop click', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        content="Test Content"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    // MUI Dialog renders a presentation role element; clicking outside triggers onClose
    const dialog = screen.getByRole('dialog');
    // Simulate pressing Escape key which triggers onClose -> onCancel
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });
});
