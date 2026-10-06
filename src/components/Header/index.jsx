import styles from "./styles.module.scss";
import logo from "../../assets/WalletIcon.png";
import { Link } from "react-router-dom";
import { useT } from "../../i18n/useT";

function scrollAbout() {
  document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
}

export default function Header() {
  const t = useT();
  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.navLeft}>
          <a className={styles.headerLinks} href="/">
            {t("landing.nav.home")}
          </a>
          <button type="button" className={styles.headerLinks} onClick={scrollAbout}>
            {t("landing.nav.about")}
          </button>
        </div>

        <Link to="/" className={styles.logoDiv}>
          <img className={styles.logoImg} src={logo} alt="" />
          <p>MyWallet</p>
        </Link>

        <div className={styles.authButtons}>
          <Link to="/signin" className={styles.headerSignIn}>
            {t("landing.nav.signIn")}
          </Link>
          <Link to="/signup" className={styles.headerSignUp}>
            {t("landing.nav.tryFree")}
          </Link>
        </div>
      </div>
    </header>
  );
}
