import walletIcon from "../../assets/WalletIcon.png";
import styles from "./styles.module.scss";
import { auth, db } from "../../../config/firebase";
import { Link } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "./displayNone.css";
import x from "../../assets/x.svg";
import { useEffect, useState } from "react";
import menu from "../../assets/menu.svg";

function HomeAuth() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const logout = async () => {
    try {
      await signOut(auth).then(() => {
        navigate("/");
      });
    } catch (err) {
      console.log(err.message);
    }
  };

  function removeMenu() {
    const menu = document.getElementById("menu");
    const img = document.getElementById("openMenu");
    menu.classList.add("displayNone");
    img.classList.remove("displayNone");
  }

  useEffect(() => {
    const handleLoad = () => {
      onAuthStateChanged(auth, (user) => {
        if (!user) {
          setIsCheckingAuth(false);
          navigate("/signin");
        }
      });

      if (window.innerWidth > 768) {
        document.getElementById("openMenu")?.classList.add("displayNone");
        document.getElementById("closeMenu")?.classList.add("displayNone");
        document.getElementById("menu")?.classList.remove("displayNone");
      }
    };

    window.addEventListener("load", handleLoad);
  }, [auth, navigate]);

  useEffect(() => {
    if (!isCheckingAuth) {
      useNavigate("/signin");
    }
  }, [isCheckingAuth, navigate]);

  function addMenu() {
    const menu = document.getElementById("menu");
    const img = document.getElementById("openMenu");
    menu.classList.remove("displayNone");
    img.classList.add("displayNone");
  }

  return (
    <>
      <main className={styles.mainContainer}>
        <div onClick={addMenu} id="openMenu" className={styles.menuDiv}>
          <img src={menu} alt="menu icon" className={styles.menuImg} />
        </div>
        <aside
          id="menu"
          className={`${styles.asideMenu} ${
            window.innerWidth <= 768 ? "displayNone" : ""
          }`}
        >
          <img
            id="closeMenu"
            onClick={removeMenu}
            src={x}
            alt="close menu"
            className={styles.closeMenu}
          />

          <Link
            to="expenses"
            onClick={window.innerWidth <= 768 ? removeMenu : null}
            className={styles.iconDiv}
          >
            <img src={walletIcon} alt="Wallet Icon" className={styles.icon} />
            <p className={styles.namep}>MyWallet</p>
          </Link>
          <ul className={styles.options}>
            <Link
              to="expenses"
              onClick={window.innerWidth <= 768 ? removeMenu : null}
              className={styles.menuLinks}
            >
              Expenses
            </Link>
            <Link
              to="newregister"
              onClick={window.innerWidth <= 768 ? removeMenu : null}
              className={styles.menuLinks}
            >
              New Register
            </Link>
          <button onClick={logout} className={styles.logoutBtn}>
            logout
          </button>
          </ul>

        </aside>
        <Outlet />
      </main>
    </>
  );
}

export default HomeAuth;
