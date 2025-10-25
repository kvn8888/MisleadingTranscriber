'use client';

interface ResultsProps {
  original: string;
  misleading: string;
  statusMessage?: string;
}

export default function Results({ original, misleading, statusMessage }: ResultsProps) {
  if (!original && !misleading && !statusMessage) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl space-y-4">
      {statusMessage && (
        <div className="text-center">
          <p className="text-lg text-blue-600 font-medium animate-pulse">
            {statusMessage}
          </p>
        </div>
      )}

      {original && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 shadow-md">
          <h3 className="font-bold text-green-900 mb-3 text-xl">✓ Original Transcription</h3>
          <p className="text-gray-800 text-lg leading-relaxed">{original}</p>
        </div>
      )}
      
      {misleading && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 shadow-md">
          <h3 className="font-bold text-red-900 mb-3 text-xl">⚠ Misleading Version</h3>
          <p className="text-gray-800 text-lg leading-relaxed">{misleading}</p>
        </div>
      )}
    </div>
  );
}
