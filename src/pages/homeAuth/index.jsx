import walletIcon from "../../assets/WalletIcon.png";
import styles from "./styles.module.scss";
import { auth } from "../../../config/firebase";
import { Link } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "./displayNone.css";
import x from "../../assets/x.svg"

function HomeAuth() {
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await signOut(auth).then(() => {
        navigate("/");
      });
    } catch (err) {
      console.log(err.message);
    }
  };

  function removeMenu(){
    const menu = document.getElementById("menu")
    const img = document.getElementById("openMenu")
    menu.classList.add("displayNone")
    img.classList.remove("displayNone")
  }

  return (
    <>
      <main className={styles.mainContainer}>
        <aside id="menu" className={`${styles.asideMenu} ${window.innerWidth <= 768 ? 'displayNone' : ''}`}>
          <img id="closeMenu" onClick={removeMenu} src={x} alt="close menu" className={styles.closeMenu}/>
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

          <button onClick={logout} className={styles.logoutBtn}>
            logout
          </button>
        </aside>
        <Outlet />
      </main>
    </>
  );
}

export default HomeAuth;
