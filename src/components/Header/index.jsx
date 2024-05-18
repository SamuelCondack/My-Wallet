import styles from "./styles.module.scss";
import logo from "../../assets/WalletIcon.png"

import AOS from 'aos';
import "aos/dist/aos.css"

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
            <a className={styles.headerSignIn} href="">Sign In</a>
            <a className={styles.headerSignUp} href="">Start For Free</a>
          </div>
        </ul>
      </div>
    </>
  );
}
