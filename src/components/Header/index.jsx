import styles from "./styles.module.scss";
import logo from "../../assets/WalletIcon.png";
import { Link } from "react-router-dom";

function scrollAbout() {
  document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
}

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.navLeft}>
          <a className={styles.headerLinks} href="/">
            Home
          </a>
          <button type="button" className={styles.headerLinks} onClick={scrollAbout}>
            About
          </button>
        </div>

        <Link to="/" className={styles.logoDiv}>
          <img className={styles.logoImg} src={logo} alt="" />
          <p>MyWallet</p>
        </Link>

        <div className={styles.authButtons}>
          <Link to="/signin" className={styles.headerSignIn}>
            Sign In
          </Link>
          <Link to="/signup" className={styles.headerSignUp}>
            Try free
          </Link>
        </div>
      </div>
    </header>
  );
}
