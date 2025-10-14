// components/ErrorDisplay.tsx
'use client';

interface ErrorDisplayProps {
    message: string;
}

export default function ErrorDisplay({ message }: ErrorDisplayProps) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
                <h2 className="text-xl font-bold text-red-600 mb-4">Map Error</h2>
                <p className="text-gray-700">{message}</p>
            </div>
        </div>
    );
};