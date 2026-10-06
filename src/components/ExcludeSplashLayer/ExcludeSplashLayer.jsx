import PropTypes from "prop-types";

function ExcludeSplashLayer({ active, className, cornerClassName }) {
  if (!active) return null;
  return (
    <span className={className} aria-hidden="true">
      <i className={cornerClassName} />
      <i className={cornerClassName} />
      <i className={cornerClassName} />
      <i className={cornerClassName} />
    </span>
  );
}

ExcludeSplashLayer.propTypes = {
  active: PropTypes.bool,
  className: PropTypes.string,
  cornerClassName: PropTypes.string,
};

export default ExcludeSplashLayer;
