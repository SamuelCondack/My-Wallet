import styles from "./styles.module.scss";

export default function Header() {
  return (
    <>
      <div className={styles.header}>
        <ul className={styles.headerContent}>
          <a className={styles.headerLinks} href="">HOME</a>
          <div className={styles.logoDiv}>
            <img
              className={styles.logoImg}
              src="./src/assets/WalletIcon.png"
              alt="logo"
            />
            <p>MyWallet</p>
          </div>
          <a className={styles.headerLinks} href="">ABOUT</a>
        </ul>
      </div>
    </>
  );
}
