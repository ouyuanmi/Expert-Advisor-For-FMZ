/*backtest
start: 2019-05-05 00:00:00
end: 2019-06-04 00:00:00
period: 5m
exchanges: [{“eid”:”OKEX”,”currency”:”BTC_USDT”,”balance”:10000,”stocks”:3}]
*/

var States = {
    FROZEN: 0,
    FREE: 1,
    FULL: 2,
    LOW: 3,
    HIGH: 4,
    HALF: 5,
};

var Interval = 500;
const originBalance = 1000;
const originStock = 3;
var state = States.FREE; //每次开仓 平仓 重置
var buyInfo = null; //每次平仓重置
var sellInfo = null; //每次开仓重置
var initAccount = null; //每次平仓重置
var beginAccount = null; //不重置
var Profit = 0; //已实现盈亏
var prefloatProfit = 0;//上次的浮动盈亏，滑动止盈 更新
var openBalance = 0;//开仓量
var isCover = false;

var tiaojian = 0; //这里可以设置 触发条件，比如 自定义的指标函数 发出开仓信号（比如返回了 数值 1 ）, 比如 0 时 是等待， 等于 2 时 是平仓
//也可能 触发了平仓条件
var Amount = 1; //这里可以把 交易的量（币数） 写在程序里 自动控制（比如，根据盘口量）， 也可以设置在界面上做成界面上的参数，在程序运行的时候传进来。

var NowPositionInfo = {//持仓信息， 每次平仓更新
    avgPrice: 0,
    amount: 0,
    floatProfit: 0
};

//获得仓位情况
function getStockState(Account, Depth) {
    var _stockBalance = (Account.Stocks + Account.FrozenStocks) * Depth.Bids[0].Price;
    var _balance = Account.Balance + Account.FrozenBalance;
    var _positionLevel = 0.0;
    if (_stockBalance != 0) {
        _positionLevel = _stockBalance / (_stockBalance + _balance);
        if (_positionLevel < 0.4) {
            return States.LOW;
        } else if (_positionLevel < 0.65) {
            return States.HALF;
        } else if (_positionLevel < 0.95) {
            return States.HIGH;
        } else {
            return States.FULL;
        }
    } else {
        return States.FREE;
    }
}

function openUpdate() {//开仓后的更新
    state = getStockState(nowAccount, nowDepth);
    sellInfo = null;
    tiaojian = 0;//重置条件
}

function closeUpdate() {//平仓后的更新
    state = States.FREE;
    addLevel = 0;
    buyInfo = null;
    initAccount = _C(exchange.GetAccount);
    NowPositionInfo.avgPrice = 0;
    NowPositionInfo.amount = 0;
    NowPositionInfo.floatProfit = 0;
    isCover = true;
    tiaojian = 0;//重置条件
}

function Calculate(nowAccount, nowDepth) {//计算并更新收益 、 浮动收益 、计算 持仓均价 、持仓量
    if (typeof (nowAccount) === 'undefined') {
        nowAccount = _C(exchange.GetAccount);
        nowDepth = _C(exchange.GetDepth);
    }
    var diff_stocks = nowAccount.Stocks - initAccount.Stocks;//币之差
    var diff_balance = nowAccount.Balance - initAccount.Balance;//钱之差
    NowPositionInfo.avgPrice = Math.abs(diff_balance) / Math.abs(diff_stocks);
    NowPositionInfo.amount = Math.abs(diff_stocks);
    NowPositionInfo.floatProfit = diff_balance + diff_stocks * nowDepth.Bids[0].Price; //此次交易的浮动盈亏
    Profit = (initAccount.Stocks - beginAccount.Stocks) * nowDepth.Bids[0].Price + (initAccount.Balance - beginAccount.Balance); //实现盈亏

    //更新入界面
}

function get_Command() {//负责交互的函数，交互及时更新 相关数值 ，熟悉的用户可以自行扩展
    var keyValue = 0;// 命令传来的参数 数值
    var way = null; //路由
    var cmd = GetCommand(); //获取 交互命令API
    if (cmd) {
        Log("按下了按钮：", cmd);//日志显示
        arrStr = cmd.split(":"); // GetCommand 函数返回的 是一个字符串，这里我处理的麻烦了，因为想熟悉一下JSON ，所以先对字符串做出处理，把函数返回的字符串以 : 号分割成2个字符串。储存在字符串数组中。

        if (arrStr.length === 2) {//接受的不是 数值型的，是按钮型的。
            jsonObjStr = '{' + '"' + arrStr[0] + '"' + ':' + arrStr[1] + '}'; // 把 字符串数组中的元素重新 拼接 ，拼接成 JSON 字符串 用于转换为JSON 对象。
            jsonObj = JSON.parse(jsonObjStr); // 转换为JSON 对象

            for (var key in jsonObj) { // 遍历对象中的 成员名
                keyValue = jsonObj[key]; //取出成员名对应的 值 ， 就是交互按钮的值
            }

            if (arrStr[0] == "upDateAmount") {// 此处为 数字型 。这里处理分为 按钮 和 数字型 。 详见 策略参数 设置界面 下的 交互设置
                way = 1;
            }
            if (arrStr[0] == "扩展1") {
                way = 2;
            }
            if (arrStr[0] == "扩展2") {
                way = 3;
            }
            if (arrStr[0] == "扩展3") {
                way = 4;
            }
        } else if (arrStr.length === 1) {// 此处为 按钮型
            //路由
            if (cmd == "cmdOpen") {
                way = 0;
            }
            if (cmd == "cmdCover") {
                way = 5;
            }
        } else {
            throw "error:" + cmd + "–" + arrStr;
        }
        switch (way) { // 分支选择 操作
            case 0://处理 发出开仓信号
                tiaojian = 1;
                break;
            case 1://处理
                Amount = keyValue;//把交互界面设置的 数值 传递给 Amount
                Log("开仓量修改为：", Amount);//提示信息
                break;
            case 2://处理

                break;
            case 3://处理

                break;
            case 4://处理

                break;
            case 5://处理 发出平仓信号
                tiaojian = 2;
                break;
            default: break;
        }
    }
}

function Loop() {//循环主体
    //获取 行情、账户等信息
    var account = _C(exchange.GetAccount);
    var records = _C(exchange.GetRecords);
    var depth = _C(exchange.GetDepth);
    var len = records.length-1;

    msg = '原始余额：' + originBalance + ' /原始仓位：' + originStock + '/n';
    //对获取的数据 容错处理
    if (records.length < 10) {//这里可以对 API 获取的数据 容错处理，这里举个例子 就是 获取的K线长度 必须大于10，小于10了 就返回 不做处理并在界面显示提示信息。
        //输出到状态栏表格，显示K线长度不足
        msg = "K线长度不足，获取中…";
        return;
    }
    msg = "K line `s length:" + (len + 1);

    //图表模板的使用—————
    $.Draw(records);
    //—————————

    //第一次启动 处理的内容———
    if (isFirst === true) {
        $.SignOP((new Date()).getTime(), null, null, 3, "图表显示启动！");// 测试标记 自定义信息 到图表上
        Log("程序启动！");
        isFirst = false;
    }
    //————————–

    //策略运行时状态栏表格上的显示数据 table.b1 就是往 b1 这个格子里 写入 "stock:" + account.Stocks + "#ff00ff"; 这些数据，可以对比截图，自己动手试试。
    table.b1 = "当前持仓:" + account.Stocks + "#ff00ff";
    table.c1 = "当前冻结持仓:" + account.FrozenStocks + "#ff00ff";
    table.d1 = "当前余额:" + account.Balance + "#ff00ff";
    table.e1 = "当前冻结余额:" + account.FrozenBalance + "#ff00ff";
    table.b2 = "开盘价:" + records[len].Open;
    table.c2 = "最高价:" + records[len].High;
    table.d2 = "最低价:" + records[len].Low;
    table.e2 = "收盘价:" + records[len].Close;
    table.b3 = "买1价:" + depth.Bids[0].Price;
    table.c3 = "买1量:" + depth.Bids[0].Amount;
    table.d3 = "卖1价:" + depth.Asks[0].Price;
    table.e3 = "卖1量:" + depth.Asks[0].Amount;
    table.c4 = "持仓均价:" + NowPositionInfo.avgPrice;
    table.d4 = "持仓量:" + NowPositionInfo.amount;
    table.e4 = "floatProfit:" + NowPositionInfo.floatProfit;
    //————————————————————————-

    //处理 策略交互
    get_Command();//获取 并处理交互

    //这里可以自定义 触发 操作的代码，比如 指标交叉了（当然这是你自定义的）， 就可以给 tiaojian 这个变量赋值 1， 即： tiaojian = 1; 这样下面满足条件就执行相应操作。

    if (state === States.FREE && tiaojian === 1) {//开仓条件，可以自行扩展，指标形态、差价、交易量 等等
        //触发了上面的if括号内的条件，这个里面就是执行具体的开仓操作了，举个例子是用 数字货币交易类库 这个模板处理开仓。
        buyInfo = $.Buy(Amount);
        if (buyInfo === null) {// $.Buy这个函数 返回 null 说明有原因导致 没有买到（即没有开仓成功，原因有多个可能。）
            return;
        }
        $.SignOP((new Date()).getTime(), buyInfo.price, buyInfo.amount, 1);// 把操作标记 到图表上 . 图表模板 用法可以看论坛上的帖子
        openUpdate();
    } else if (state === 1 && tiaojian === 2) {
        sellInfo = $.Sell(NowPositionInfo.amount);
        if (buyInfo === null) {
            return;
        }
        $.SignOP((new Date()).getTime(), sellInfo.price, sellInfo.amount, 0);// 把操作标记 到图表上
        closeUpdate();
    }

    //如果平仓了，更新收益———————–
    Calculate(account, depth);//计算收益，更新持仓状态
    if (isCover === true) {
        LogProfit(Profit);
        isCover = false;
    }
    //—————————————-

    //更新图表—————————
    $.UpDateChart(records);
    //———————————
}

var table = null;
var msg = "";//显示在状态栏表格头部的 消息
var isFirst = true;

function main() {
    //初始化
    if (isLogReset === true) {
        LogReset();
    }

    beginAccount = _C(exchange.GetAccount);//程序开始运行时的初始账户信息
    initAccount = beginAccount;//每次开仓前的账户信息

    if (_G('originAccount') == null) {
        var origin = initAccount;
        var ticker = _C(exchange.GetTicker());
        origin.price = ticker.Buy;
        _G('originAccount', JSON.stringify(origin));
    }

    table = $.TableInit(5, 6);
    //初始化表格 5，代表 表格生成5列 分别是 a b c d e ， 6代表表格生成 6行 分别是 0 1 2 3 4 5 6 。 这样最左上角的表格单元的坐标就是 a0 , table.a0 = 3; 此时就会显示到相应的表格

    //给表格写上不许要变动的内容——————
    table.a1 = "当前仓位:" + "#ff00ff";
    table.a2 = "当前交易数据[length-1]:";
    table.a3 = "买1价/卖1价:";
    table.a0 = "开始仓位:";
    table.b0 = "持仓:" + beginAccount.Stocks;
    table.c0 = "冻结持仓:" + beginAccount.FrozenStocks;
    table.d0 = "余额:" + beginAccount.Balance;
    table.e0 = "冻结余额:" + beginAccount.FrozenBalance;
    //—————————————————-

    while (true) {
        Loop();//循环函数
        $.UpDateLogStatus(msg);//更新表格 数据
        msg = "";
        Sleep(Interval);
    }
}