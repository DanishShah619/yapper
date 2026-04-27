import { render, screen, fireEvent } from '@testing-library/react';
import ChatPage from '../page';

describe('ChatPage', () => {
  it('renders input and send button', () => {
    render(<ChatPage roomId="test-room" />);
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });
});
