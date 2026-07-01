import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[60vh] px-6 font-manrope">
      <p className="text-6xl font-bold text-primary mb-3">404</p>
      <h1 className="text-xl font-semibold text-textcolor mb-2">
        Page not found
      </h1>
      <p className="text-sm text-text-muted mb-6 max-w-sm">
        The page you’re looking for doesn’t exist or may have been moved.
      </p>
      <button
        type="button"
        onClick={() => navigate("/dashboard")}
        className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Back to dashboard
      </button>
    </div>
  );
};

export default NotFound;
