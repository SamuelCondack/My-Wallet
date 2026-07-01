import walletIcon from "../../assets/WalletIcon.png";
import styles from "./styles.module.scss";
import { auth } from "../../../config/firebase";
import { Link } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "./displayNone.css";
import x from "../../assets/x.svg";
import { useEffect, useState } from "react";
import menu from "../../assets/menu.svg";
import { motion, AnimatePresence } from "framer-motion";

function HomeAuth() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [menuHidden, setMenuHidden] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

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
    setMenuHidden(true);
  }

  function addMenu() {
    setMenuHidden(false);
  }

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setMenuHidden(false);
      } else {
        setMenuHidden(true);
      }
    };

    onAuthStateChanged(auth, (user) => {
      if (!user) {
        setIsCheckingAuth(false);
        navigate("/signin");
      }
    });

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [navigate]);

  useEffect(() => {
    if (!isCheckingAuth) {
      navigate("/signin");
    }
  }, [isCheckingAuth, navigate]);

  return (
    <>
      <main className={styles.mainContainer}>
        {isMobile && menuHidden && (
          <div onClick={addMenu} id="openMenu" className={styles.menuDiv}>
            <img src={menu} alt="menu icon" className={styles.menuImg} />
          </div>
        )}

        <AnimatePresence>
          {!menuHidden && (
            <motion.aside
              id="menu"
              className={styles.asideMenu}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            >
              {isMobile && (
                <img
                  id="closeMenu"
                  onClick={removeMenu}
                  src={x}
                  alt="close menu"
                  className={styles.closeMenu}
                />
              )}

              <Link
                to="expenses"
                onClick={isMobile ? removeMenu : null}
                className={styles.iconDiv}
              >
                <img
                  src={walletIcon}
                  alt="Wallet Icon"
                  className={styles.icon}
                />
                <p className={styles.namep}>MyWallet</p>
              </Link>
              <ul className={styles.options}>
                <Link
                  to="expenses"
                  onClick={isMobile ? removeMenu : null}
                  className={styles.menuLinks}
                >
                  Expenses
                </Link>
                <Link
                  to="newregister"
                  onClick={isMobile ? removeMenu : null}
                  className={styles.menuLinks}
                >
                  New Register
                </Link>
                <button onClick={logout} className={styles.logoutBtn}>
                  logout
                </button>
              </ul>
            </motion.aside>
          )}
        </AnimatePresence>
        <Outlet />
      </main>
    </>
  );
}

export default HomeAuth;
