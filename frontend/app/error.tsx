"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="panel grid min-h-[420px] place-items-center p-8 text-center">
      <div>
        <p className="metric text-[#fb7185]">Training interrupted</p>
        <h1 className="mt-3 text-3xl font-semibold">This session hit an unexpected error.</h1>
        <p className="mt-3 text-[#8995a7]">Your previous saved attempts are safe.</p>
        <button className="btn btn-primary mt-6" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
