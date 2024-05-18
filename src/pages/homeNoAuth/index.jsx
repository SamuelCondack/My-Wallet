import { Link } from "react-router-dom";
import Header from "../../components/Header";
import styles from "./styles.module.scss";
import outcomeImg from "../../assets/outcomePinkImg.png";
import Footer from "../../components/Footer";
import AOS from 'aos';
import "aos/dist/aos.css"

AOS.init()

import React from "react";

export default function HomeNoAuth() {
  return (
    <>
      <Header/>
      <div className={styles.firstContent} data-aos="flip-left" data-aos-duration="1600">
        <div className={styles.title}>
          <h1>
            Take charge of <br /> your money and <br />
            live your{" "}
          </h1>
        </div>
        <div className={styles.subTitle}>
          <p>
            Embark on a financial journey towards a life filled with freedom,
            security, and endless possibilities. Take control of your finance
            and watch your life flourish
          </p>
          <Link className={styles.buttonLink} to="/">
            <button className={styles.registerBtn}>Try it now!</button>
          </Link>
        </div>
      </div>
      <div className={styles.secondContent}>
        <h1>Your everyday finance control app</h1>
        <div className={styles.firstLine}>
          <div className={styles.notesDiv} data-aos="fade-right" data-aos-duration="1600">
            <p>Take notes of your</p>
            <div className={styles.notes}>
              <div className={styles.outcome}>
                <div className={styles.arrowDiv}>
                  <img
                    className={styles.upRightArrow}
                    src={outcomeImg}
                    alt=""
                  />
                  <p className={styles.percentage}>+3.1%</p>
                </div>
                <p className={styles.outcomeParagraph}>Outcome</p>
                <p
                  className={`${styles.outcomeParagraph} ${styles.outcomePrice}`}
                >
                  $1.347.00
                </p>
              </div>
            </div>
          </div>
          <div className={styles.limitsDiv} data-aos="fade-right" data-aos-duration="1600">
            <p>Define your limits</p>
            <div className={styles.spendingLimitsItem}>
              <p>Spending Limits</p>
              <div className={styles.spendingLimitsOneLine}>
                <p className={styles.spendingLimitsPrice}>$1.347.00</p>
                <p className={styles.percentage}>+3.1%</p>
              </div>
              <div className={styles.limitsColor}>
                <div className={styles.firstLimit}></div>
                <div className={styles.secondLimit}></div>
                <div className={styles.thirdLimit}></div>
                <div className={styles.fourthLimit}></div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.secondLine}>
          <div className={styles.dailyTransaction} data-aos="fade-right" data-aos-duration="1600">
            <p>Overview your transactions</p>
            <div className={styles.dailyTransactionsItem}>
              <div className={styles.dailyTransactionsHeader}>
                Daily Transaction
                <div className={styles.paymentsDiv}>
                  <div className={styles.cashPayment}>
                    <p className={styles.cashIcon}>Cash</p>
                  </div>
                  <div className={styles.digitalPayment}>
                    <p className={styles.digitalIcon}>Digital</p>
                  </div>
                  <div className={styles.creditPayment}>
                    <div className=""></div>{" "}
                    <p className={styles.creditIcon}>Credit</p>
                  </div>
                </div>
              </div>
              <div className={styles.dailyTransactionsGraphLine}>
                <p className={styles.blankGraph}></p>
                <p className={styles.blankGraph}></p>
                <p className={styles.blankGraph}></p>
                <p className={styles.creditGraph}></p>
                <p className={styles.blankGraph}></p>
                <p className={styles.blankGraph}></p>
                <p className={styles.blankGraph}></p>
              </div>
              <div className={styles.dailyTransactionsGraphLine}>
                <p className={styles.blankGraph}></p>
                <p className={styles.digitalGraph}></p>
                <p className={styles.blankGraph}></p>
                <p className={styles.digitalGraph}></p>
                <p className={styles.digitalGraph}></p>
                <p className={styles.digitalGraph}></p>
                <p className={styles.blankGraph}></p>
              </div>
              <div className={styles.dailyTransactionsGraphLine}>
                <p className={styles.digitalGraph}></p>
                <p></p>
                <p className={styles.digitalGraph}></p>
                <p></p>
                <p></p>
                <p></p>
                <p className={styles.digitalGraph}></p>
              </div>
              <div className={styles.dailyTransactionsGraphLine}>
                <p></p>
                <p></p>
                <p></p>
                <p></p>
                <p></p>
                <p></p>
                <p></p>
              </div>
              <div className={styles.weekDays}>
                <p>Sun</p>
                <p>Mon</p>
                <p>Tue</p>
                <p>Wed</p>
                <p>Thu</p>
                <p>Fri</p>
                <p>Sat</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer/>
    </>
  );
}
