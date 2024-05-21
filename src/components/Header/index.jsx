import styles from "./styles.module.scss";
import logo from "../../assets/WalletIcon.png"

import AOS from 'aos';
import "aos/dist/aos.css"
import { Link } from "react-router-dom";

AOS.init()

export default function Header() {
  return (
    <>
      <div className={styles.header} data-aos="zoom-in" data-aos-duration="1000">
        <ul className={styles.headerContent}>
          <a className={styles.headerLinks} href="">HOME</a>
          <a className={styles.headerLinks} href="">ABOUT</a>
          <div className={styles.logoDiv}>
            <img
              className={styles.logoImg}
              src={logo}
              alt="logo"
            />
            <p>MyWallet</p>
          </div>
          <div className={styles.authButtons}>
            <Link to="signin"  className={styles.headerSignIn}>Sign In</Link>
            <Link to="signup" className={styles.headerSignUp}>Start For Free</Link>
          </div>
        </ul>
      </div>
    </>
  );
}
