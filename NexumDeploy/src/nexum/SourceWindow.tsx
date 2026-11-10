import React from 'react';
import SourceCodeWindow from '../istrong/components/source/SourceCodeWindow';

export const SourceWindow: React.FC<{ onClose: () => void }> = ({ onClose }) => <SourceCodeWindow onClose={onClose} />;
