import styles from "./styles.module.scss";

export default function Header() {
  return (
    <>
      <div className={styles.header}>
        <ul className={styles.headerContent}>
          <a className={styles.headerLinks} href="">HOME</a>
          <a className={styles.headerLinks} href="">ABOUT</a>
          <div className={styles.logoDiv}>
            <img
              className={styles.logoImg}
              src="./src/assets/WalletIcon.png"
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
