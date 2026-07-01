import styles from "./styles.module.scss";
import logo from "../../assets/WalletIcon.png";
import { Link } from "react-router-dom";

function scrollToAbout() {
  window.scroll({
    top: 50000,
    behavior: "smooth",
  });
}

export default function Header() {
  return (
    <div className={styles.header} data-aos="zoom-in" data-aos-duration="1000">
      <ul className={styles.headerContent}>
        <Link to="/" className={styles.headerLinks}>
          HOME
        </Link>
        <a className={styles.headerLinks} onClick={scrollToAbout}>
          ABOUT
        </a>
        <div className={styles.logoDiv}>
          <img className={styles.logoImg} src={logo} alt="logo" />
          <p>MyWallet</p>
        </div>
        <div className={styles.authButtons}>
          <Link to="/signin" className={styles.headerSignIn}>
            Sign In
          </Link>
          <Link to="/signup" className={styles.headerSignUp}>
            Start For Free
          </Link>
        </div>
      </ul>
    </div>
  );
}
