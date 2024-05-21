import walletIcon from "../../assets/WalletIcon.png";
import styles from "./styles.module.scss";
import NewRegister from "../NewRegister/NewRegister";
import { Link } from "react-router-dom";
import { Outlet } from "react-router-dom";

function HomeAuth() {
  return (
    <>
      <main className={styles.mainContainer}>
        <aside className={styles.asideMenu}>
          <Link to="expenses" className={styles.iconDiv}>
            <img src={walletIcon} alt="Wallet Icon" className={styles.icon} />
            <p className={styles.namep}>MyWallet</p>
          </Link>
          <ul className={styles.options}>
            <Link to="expenses" className={styles.menuLinks}>
              Expenses
            </Link>
            <Link to="newregister" className={styles.menuLinks}>
              New Register
            </Link>
          </ul>
        </aside>
        <Outlet />
      </main>
    </>
  );
}

export default HomeAuth;
