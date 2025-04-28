# Can Your Zip File Predict House Prices?

> What if the secret of good prediction is the same trick you use every day to squeeze files into an archive?  
> **Learning ≈ kinda Compression**

---

## A two-minute story

> **Alice and Bob at the café.**  
> Alice wants to know tomorrow’s house prices in California. Bob already has a full spreadsheet of _features_ (income, age, rooms, …) that Alice also owns. All Bob really needs to send is the _labels_—the prices themselves.
>
> - **Naïve way:** Bob e-mails the 4 000 numbers raw.
> - **Smarter way:** Bob trains a model on his laptop, writes down the coefficients (just a dozen numbers!), and e-mails _those_ instead.  
>   When Alice plugs the coefficients into the same model on her side, she rebuilds the prices with only tiny residual errors.  
>   **Moral:** A good supervised model is a _compression scheme_ for the labels, conditional on the shared features. Whoever sends the fewest bits wins.

Keep this picture in mind; every equation below formalises Bob’s message length.

---

## 1 Why read this post?

By the end you will be able to

- explain **Kolmogorov complexity**;
- compute a **compression-based bound** for a real tabular dataset using `gzip`;
- measure how **supervised learning** “compresses” _labels_ given _features_ with **MDL**, **AIC**, and **BIC**;
- rank several regressors **in bits** using MDL, not only by RMSE;
- retell Alice and Bob’s trick to your team.

All of this funnels into one goal: **choose the model that best minimises description length.**

---

## 2 Core vocabulary

| Term                                 | Plain description                                                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kolmogorov complexity** _K(x)_     | Shortest computer program that prints _x_. The exact value is **uncomputable**; we work with **upper bounds** from real compressors such as `gzip`. |
| **Minimum-Description-Length (MDL)** | Pick the model that minimises **total bits** = bits for the model + bits for the residual errors.                                                   |
| **AIC**                              | $\text{AIC}= -2\ell + 2k$ (ℓ = log-likelihood, _k_ = parameters). Light penalty. Unit: **nats**.                                                    |
| **BIC**                              | $\text{BIC}= -2\ell + (\ln n)k$ (n = samples). Heavier penalty as _n_ grows.                                                                        |
| **Nat**                              | Information unit when logs use base _e_. 1 nat ≈ 1.44 bits. Divide by $\ln2$ to convert.                                                            |
| **Residual**                         | The difference between the true label and the model’s prediction.                                                                                   |
| **Likelihood**                       | Probability of the data given the model.                                                                                                            |
| **Log-likelihood**                   | Logarithm of the likelihood.                                                                                                                        |
| **Negative log-likelihood (NLL)**    | The negative of the log-likelihood.                                                                                                                 |

---

## 2.5 Mathematical cheat-sheet

### 2.5.1 Unsupervised data description (Kolmogorov complexity)

$$
K(X)\;\le\;\underbrace{|\texttt{zip}(X)|}_{\text{compressed features}}\;+
\underbrace{|\texttt{unzip program}|}_{\text{decoder}}.
$$

_Why this holds._ $K(X)$ is the length of the shortest program that generates X; any compressor plus its decompressor is one such program, so its combined size can only be $\geq K(X)$.

### 2.5.2 Supervised description of labels (MDL)

Given that both sender and receiver already know _X_ (think of Alice and Bob sharing the spreadsheet):

$$
K(y\mid X)\;\le\;\underbrace{K(h)}_{\text{model bits}}\;+
\underbrace{K\bigl(y\mid h,X\bigr)}_{\text{residual bits}}.
$$

| **Term**       | **Bob and Alice definition**                                  | **Formal definition**      |
| -------------- | ------------------------------------------------------------- | -------------------------- |
| $K(h)$         | The email size of Bob’s coefficients.                         | The size of the model.     |
| $K(y\mid h,X)$ | Any leftover “patch file” Alice needs to fix the predictions. | The size of the residuals. |

The model is good if that sum beats naïvely transmitting every price.

---

### Quick MDL FAQ

**Q 1 – If a model’s encoding is extremely small but its predictions are poor, can MDL still prefer it?**  
**A:** No. A tiny $K(h)$ is overshadowed by a huge residual cost $K(y\mid h,X)$ when predictions are wrong. The sum stays large, so MDL rejects the model.

**Q 2 – How can I tell whether a model is good under MDL?**  
**A:** **Q 2 – How do I assess a model under MDL?**  
On held-out data, compute each model’s description length $L = K(h) + K(y \mid h, X)$ and select the model minimizing $L$, provided its predictive performance (e.g. RMSE or $R^2$) does not degrade beyond an acceptable tolerance.

**Q 3 – What if the labels are essentially noise?**  
**A:** All models incur roughly the same residual bits. MDL therefore defaults to the cheapest header: often no model at all, just transmitting $y$ verbatim.

**Q 4 – Does MDL make classical error metrics obsolete?**  
**A:** MDL merges fit and complexity into one unit, but reporting RMSE or log-loss remains useful for additional context. MDL is a complementary tool, not a replacement.

**Q 5 – Can I use a non-Gaussian likelihood for $K(y\mid h,X)$?**  
**A:** Absolutely. Replace the Gaussian NLL with any likelihood that matches your residuals; the MDL framework is flexible. Just ensure the model’s complexity $K(h)$ is still computable.

**Q 6 – Does MDL account for computational complexity or runtime?**  
**A:** No. Kolmogorov complexity counts _bits_, not time or memory. Two models with identical bit-lengths but wildly different runtimes could be equally valid under MDL. If runtime matters, consider it separately (e.g. by logging FLOPS, time, or memory usage).

---

## 3 Dataset and first inspection

We demonstrate on the **California Housing** dataset (20 640 rows × 8 features).

```python
from sklearn.datasets import fetch_california_housing

housing = fetch_california_housing()
X, y = housing.data, housing.target  # median house value (×100 000 $)
print(X.shape, y.shape)              # (20640, 8) (20640,)
```

```python
print(housing.feature_names)               # ['MedInc', 'HouseAge', ...]
print(housing.DESCR.split('\n')[:8])       # brief provenance peek
```

---

## 4 Supervised compression: models as encoders

### 4.1 Models under test

```python
from sklearn.linear_model import LinearRegression
from sklearn.tree import DecisionTreeRegressor
from sklearn.svm import SVR
from sklearn.neighbors import KNeighborsRegressor

models = {
    "Linear":  LinearRegression(),
    "Tree":    DecisionTreeRegressor(random_state=42, max_depth=6),
    "SVR":     SVR(C=1.0, epsilon=0.1),
    "k-NN":    KNeighborsRegressor(n_neighbors=5),
}
```

### 4.2 Split data

```python
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42)
```

### 4.3 Helpers

```python
def n_params(m):
    if isinstance(m, LinearRegression):
        return m.coef_.size + 1          # weights + bias
    if isinstance(m, DecisionTreeRegressor):
        return m.tree_.node_count        # one per node (approx.)
    if isinstance(m, SVR):
        sv = m.support_vectors_
        return sv.size + 1               # SV coordinates + bias
    if isinstance(m, KNeighborsRegressor):
        return X_train.size              # memorises entire train set
    return 0
```

### 4.4 Fit, evaluate, and price each model (AIC & BIC)

```python
from sklearn.metrics import mean_squared_error
import pandas as pd
import math


ln2 = math.log(2)
records = []
for name, mdl in models.items():
    mdl.fit(X_train, y_train)
    mse = mean_squared_error(y_test, mdl.predict(X_test))
    k   = n_params(mdl)
    n   = len(y_test)
    nll = n/2 * (math.log(2*math.pi*mse) + 1)          # nats
    bic_bits = (nll + 0.5*k*math.log(n)) / ln2         # bits
    aic_bits = (nll + k) / ln2                         # bits
    records.append((name, k, mse, bic_bits, aic_bits))

results = pd.DataFrame(records, columns=[
    "Model", "k", "MSE", "BIC_bits", "AIC_bits"])
results.sort_values("BIC_bits", inplace=True)
results
```

---

## 5 What do we learn?

| Model  | $k$     | BIC (bits)                  | AIC (bits)                  | Interpretation                                                                          |
| ------ | ------- | --------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| Linear | 9       | 6 756 (baseline)            | 6 715 (baseline)            | Nine parameters capture nearly all structure; this sets our reference.                  |
| Tree   | 127     | 7 133 (+ 377)               | 6 553 (– 162)               | Depth-6 splits reduce residual bits (AIC) by ~162 but add ~377 bits of model.           |
| SVR    | ≈ 121 k | 737 142 (+ 730 386 ≈ 730 k) | 184 149 (+ 177 433 ≈ 177 k) | Encoding support vectors costs hundreds of thousands of bits—far outweighing fit gains. |
| k-NN   | ≈ 132 k | 802 102 (+ 795 346 ≈ 795 k) | 199 359 (+ 192 644 ≈ 193 k) | Memorizing the full train set is “compression” in name only—bit-cost is enormous.       |

MDL applies <a href="https://simple.wikipedia.org/wiki/Occam%27s_razor#:~:text=Occam's%20razor%20(or%20Ockham's%20razor,the%20more%20unlikely%20an%20explanation.">Occam’s razor</a> in information‐theoretic terms: it only adopts a more complex model if the reduction in residual‐error bits exceeds the extra bits needed to encode its parameters; otherwise it favors the simpler model.

---

## 6 Limitations and good practice

1. **AIC/BIC assumptions.** i.i.d. observations + regular parametric models; time-series or deep nets may break them.
2. **Compression choice.** `gzip` is byte-oriented; columnar codecs (Parquet + Snappy) compress numeric tables far better.
3. **Parameter counting crude for k-NN.** We charged the whole training set; a tighter bound could encode only neighbour indices.

---

## 7 Take-away

Model selection through **Minimum-Description-Length** rewards exactly the trade-off we want: _good predictions with as little complexity as possible_. Whenever classic metrics give you a headache, count the bits—and remember Alice and Bob’s lightweight email.
