import Link from "next/link";

export default function NotFound() {
  return (
    <div className="panel grid min-h-[420px] place-items-center p-8 text-center">
      <div>
        <p className="metric text-[#63e6be]">404</p>
        <h1 className="mt-3 text-3xl font-semibold">That drill is not on the training floor.</h1>
        <Link className="btn btn-primary mt-6 inline-block" href="/">
          Browse games
        </Link>
      </div>
    </div>
  );
}
