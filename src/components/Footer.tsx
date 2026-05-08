export function Footer() {
  return (
    <footer className="bg-black py-14 px-6">
      <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[#969696] text-sm">
          Copyright &copy; {new Date().getFullYear()} Twelves Cricket Club - All
          Rights Reserved.
        </p>
        <a
          href="https://cricclubs.com/NWCL"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#969696] text-sm hover:text-white transition-colors"
        >
          NWCL on CricClubs
        </a>
      </div>
    </footer>
  );
}
