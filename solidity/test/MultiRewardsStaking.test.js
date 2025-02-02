const MultiRewardsStaking = artifacts.require("MultiRewardsStaking");
const UniswapETH_Plot = artifacts.require("TokenMock");
const PlotusToken = artifacts.require('PlotXToken');
const MockMultiRewardsStaking = artifacts.require('MockMultiRewardsStaking');
const { toHex, toWei } = require("./utils/ethTools.js");
const increaseTimeTo = require("./utils/increaseTime.js").increaseTimeTo;
const assertRevert = require("./utils/assertRevert.js").assertRevert;
const DummyTokenMock = artifacts.require('DummyTokenMock');
const latestTime = require("./utils/latestTime.js").latestTime;
const nullAddress = "0x0000000000000000000000000000000000000000";

contract("InterestDistribution - Scenario based calculations for staking model", ([S1, S2, S3, vaultAdd]) => {
  let stakeTok,
      plotusToken,
      staking,
      stakeStartTime,
      stakingPeriod,
      rewardToBeDistributed1,
      dummystakeTok,
      dummyRewardTok,
      dummyStaking;

    before(async () => {
      
      stakeTok = await UniswapETH_Plot.new("UEP","UEP");
      plotusToken = await PlotusToken.new(toWei("30000000"), S1);
      dummystakeTok = await DummyTokenMock.new("UEP","UEP");
      dummyRewardTok = await DummyTokenMock.new("PLT","PLT");
      let nowTime = await latestTime();
      stakingPeriod = (24*3600*365);
      rewardToBeDistributed1 = toWei("500000");
      staking = await MultiRewardsStaking.new(stakeTok.address, [plotusToken.address], stakingPeriod, [rewardToBeDistributed1], (await latestTime())/1 + 1, vaultAdd);

      dummyStaking = await MockMultiRewardsStaking.new(dummystakeTok.address, [dummyRewardTok.address], (24*3600*365), [toWei("500000")], (await latestTime())/1+1500, vaultAdd);

      await plotusToken.transfer(staking.address, toWei("500000"));

      await dummyRewardTok.mint(dummyStaking.address, toWei("500000"));
      await dummystakeTok.mint(dummyStaking.address, toWei("100"));
      
      await stakeTok.mint(S1, toWei("1000"));
      await stakeTok.mint(S2, toWei("1000"));
      await stakeTok.mint(S3, toWei("1000"));
      await stakeTok.approve(staking.address, toWei("10000", "ether"), {
        from: S1
      });
      await stakeTok.approve(staking.address, toWei("10000", "ether"), {
        from: S2
      });
      await stakeTok.approve(staking.address, toWei("10000", "ether"), {
        from: S3
      });

      stakeStartTime = (await staking.stakingStartTime())/1;
      console.log("starttime: ", stakeStartTime);
      
    });
  describe('Multiple Staker stakes, no withdrawal', function() {
    
    it("Staker 1 stakes 100 Token after 10 seconds", async () => {

      let beforeStakeTokBal = await stakeTok.balanceOf(S1);
      let beforeStakeTokBalStaking = await stakeTok.balanceOf(staking.address);
      let vaultBal = await plotusToken.balanceOf(vaultAdd);
      
      // increase 10 seconds
      await increaseTimeTo(stakeStartTime + 10);


      /**
        * S1 stakes 100 tokens
        */
        await staking.stake(toWei("100"), {
          from: S1
        });
        let vaultBalAfter = await plotusToken.balanceOf(vaultAdd);
        let afterStakeTokBal = await stakeTok.balanceOf(S1);

        let afterStakeTokBalStaking = await stakeTok.balanceOf(staking.address);
        expect((beforeStakeTokBal - afterStakeTokBal)).to.be.equal((toWei("100", "ether"))/1);
        expect((afterStakeTokBalStaking - beforeStakeTokBalStaking)).to.be.equal((toWei("100", "ether"))/1); 

        // accuraccy is of 1 sec
        let vaultbalanceExpectedInf = 10 * rewardToBeDistributed1 / stakingPeriod;
        let vaultbalanceExpectedSup = 11 * rewardToBeDistributed1 / stakingPeriod;
        
        expect((Math.abs((vaultbalanceExpectedSup - (vaultBalAfter - vaultBal))))).to.be.below(vaultbalanceExpectedSup-vaultbalanceExpectedInf + 2); 

        let stakerData = await staking.getStakerData(S1);
        let interestData = await staking.interestData();
        let yieldData = await staking.getYieldData(S1);

        // 1st stake so globalTotalStake is 0, hence 
        // globalYieldPerToken and gdYieldRate are  0.
        expect((yieldData[0][0]).toString()).to.be.equal("0");
        expect((yieldData[1][0]).toString()).to.be.equal("0");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(toWei("100", "ether")); 

        // totalStake of S1
        expect((stakerData[0]).toString()).to.be.equal(toWei("100", "ether")); 

    });

    it("Staker 2 stakes 50 Token at 100 seconds", async () => {

      let beforeStakeTokBal = await stakeTok.balanceOf(S2);

      let beforeStakeTokBalStaking = await stakeTok.balanceOf(staking.address);
      
      // increase 90 seconds
      await increaseTimeTo(stakeStartTime + 99);


      /**
        * S2 stakes 50 tokens
        */
        await staking.stake(toWei("50"), {
          from: S2
        });


        let afterStakeTokBal = await stakeTok.balanceOf(S2);

        let afterStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

        expect((beforeStakeTokBal - afterStakeTokBal)).to.be.equal((toWei("50", "ether"))/1);
        expect((afterStakeTokBalStaking - beforeStakeTokBalStaking)).to.be.equal((toWei("50", "ether"))/1); 

        let stakerData = await staking.getStakerData(S2);
        let interestData = await staking.interestData();
        let yieldData = await staking.getYieldData(S2);
      
        expect((Math.round(yieldData[0][0]/1e15)-14)).to.be.below(2);
        expect(((Math.round(yieldData[1][0]/1e16 - 71)).toString())/1).to.be.below(3);

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(toWei("150", "ether")); 

        // totalStake of S2
        expect((stakerData[0]).toString()).to.be.equal(toWei("50", "ether")); 
 
    });

    it("Staker 3 stakes 360 Token at 500 seconds", async () => {

      
      let beforeStakeTokBal = await stakeTok.balanceOf(S3);

      let beforeStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

      // increase 400 seconds
      await increaseTimeTo(stakeStartTime + 499);
      
      await staking.stake(toWei("360"), {
          from: S3
        });

        let afterStakeTokBal = await stakeTok.balanceOf(S3);

        let afterStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

        expect((beforeStakeTokBal - afterStakeTokBal)).to.be.equal((toWei("360", "ether"))/1);
        expect((afterStakeTokBalStaking - beforeStakeTokBalStaking)).to.be.equal((toWei("360", "ether"))/1);  

        let stakerData = await staking.getStakerData(S3);
        let interestData = await staking.interestData();
        let yieldData = await staking.getYieldData(S3);
   
        expect((Math.floor(yieldData[0][0]/1e15)).toString()).to.be.equal("56");
        expect((Math.floor(yieldData[1][0]/1e18)).toString()).to.be.equal("20");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(toWei("510")); 
        

        // totalStake of S3
        expect((stakerData[0]).toString()).to.be.equal(toWei("360")); 
        
    });

    it("Staker 1 again stakes 250 Token 800 seconds", async () => {

      let beforeStakeTokBal = await stakeTok.balanceOf(S1);

      let beforeStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

      // increase time
      await increaseTimeTo(stakeStartTime + 800);

      
      await staking.stake(toWei("250"), {
          from: S1
        });

        let afterStakeTokBal = await stakeTok.balanceOf(S1);

        let afterStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

        expect((beforeStakeTokBal - afterStakeTokBal)).to.be.equal((toWei("250"))/1);
        expect((afterStakeTokBalStaking - beforeStakeTokBalStaking)).to.be.equal((toWei("250"))/1);   

        let stakerData = await staking.getStakerData(S1);
        let interestData = await staking.interestData();
        let yieldData = await staking.getYieldData(S1);

        expect((Math.abs(yieldData[0][0]/1e15) - 66)).to.be.below(2);
        expect((Math.abs(yieldData[1][0]/1e18) - 16)).to.be.below(2);

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(toWei("760", "ether")); 
        

        // totalStake of S1
        expect((stakerData[0]).toString()).to.be.equal(toWei("350", "ether")); 
      
    });

    it("Computing updated yield data at 1000 seconds", async () => {

      // increase time
      await increaseTimeTo(stakeStartTime + 999);

      let statsDta = await staking.getStatsData(S1);

      expect((Math.floor((statsDta[0])/1e18)).toString()).to.be.equal("760");
      expect((Math.floor((statsDta[1][0])/1e18)).toString()).to.be.equal("500000");
      expect((Math.floor((statsDta[2][0])/1e18)).toString()).to.be.equal("230263");
      expect((Math.floor((statsDta[3][0])/1e18)).toString()).to.be.equal("15");
      expect((Math.floor((statsDta[4][0])/1e18)).toString()).to.be.equal("8");

      statsDta = await staking.getStatsData(S2);

      expect((Math.floor((statsDta[0])/1e18)).toString()).to.be.equal("760");
      expect((Math.floor((statsDta[1][0])/1e18)).toString()).to.be.equal("500000");
      expect((Math.floor((statsDta[2][0])/1e18)).toString()).to.be.equal("32896");
      expect((Math.floor((statsDta[3][0])/1e18)).toString()).to.be.equal("15");
      expect((Math.floor((statsDta[4][0])/1e18)).toString()).to.be.equal("2");

      statsDta = await staking.getStatsData(S3);

      expect((Math.floor((statsDta[0])/1e18)).toString()).to.be.equal("760");
      expect((Math.floor((statsDta[1][0])/1e18)).toString()).to.be.equal("500000");
      expect((Math.floor((statsDta[2][0])/1e18)).toString()).to.be.equal("236839");
      expect((Math.floor((statsDta[3][0])/1e18)).toString()).to.be.equal("15");
      expect((Math.floor((statsDta[4][0])/1e18)).toString()).to.be.equal("4");

          
      await staking
          .updateGlobalYield()
          .catch(e => e);

      
      let interestData = await staking.interestData();
            
      expect(((Math.floor(interestData[1]/1e15 - 70)).toString())/1).to.be.below(2);

      // globalTotalStake
      expect((interestData[0]).toString()).to.be.equal(toWei("760", "ether")); 
      
      
      expect((Math.floor((await staking.calculateInterest(S1))/1e18)).toString()).to.be.equal("8");
      
      expect((Math.floor((await staking.calculateInterest(S2))/1e18)).toString()).to.be.equal("2");
      
      expect((Math.floor((await staking.calculateInterest(S3))/1e18)).toString()).to.be.equal("4");
    });
  });

  describe('Few stakers stake and Few staker withdraw Interest', function() {
    it("Staker 1 stakes 60 Token at 2000 seconds", async () => {

      let beforeStakeTokBal = await stakeTok.balanceOf(S1);

      let beforeStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

      // increase time
      await increaseTimeTo(stakeStartTime + 2000);

      
        await staking.stake(toWei("60"), {
          from: S1
        });

        let afterStakeTokBal = await stakeTok.balanceOf(S1);

        let afterStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

        expect((beforeStakeTokBal - afterStakeTokBal)).to.be.equal((toWei("60", "ether"))/1);
        expect((afterStakeTokBalStaking - beforeStakeTokBalStaking)).to.be.equal((toWei("60", "ether"))/1);   


        let stakerData = await staking.getStakerData(S1);
        let interestData = await staking.interestData();
        let yieldData = await staking.getYieldData(S1);

           
        expect(((Math.floor(yieldData[0]/1e15 - 90)).toString())/1).to.be.below(2);
        expect((Math.floor(yieldData[1]/1e18)).toString()).to.be.equal("21");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(toWei("820")); 
        

        // totalStake of S1
        expect((stakerData[0]).toString()).to.be.equal(toWei("410")); 
        
    });

    it("Staker 2 Withdraws their share of interest at 2500 seconds", async () => {

      let beforePlotBal = await plotusToken.balanceOf(S2);
      let beforeStakerData = await staking.getStakerData(S2);

      // increase time
      await increaseTimeTo(stakeStartTime + 2500);

      let interests = await staking.calculateInterest(S2);
      
      await staking.withdrawInterest( {
          from: S2
        });

        let afterPlotBal = await plotusToken.balanceOf(S2);
        let tokenInterest = Math.round((afterPlotBal - beforePlotBal)/1e18);

        expect(tokenInterest.toString()).to.be.equal("4"); 

        let stakerData = await staking.getStakerData(S2);
        let interestData = await staking.interestData();
        let yieldData = await staking.getYieldData(S2);
        let withdrawnToDate = beforeStakerData[1][0] + stakerData[1][0]-interests[0];

        expect((Math.floor(yieldData[0][0]/1e15)).toString()).to.be.equal("100");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(toWei("820", "ether")); 
        
        // totalStake of S2
        expect((stakerData[0]).toString()).to.be.equal(toWei("50", "ether")); 

        
        expect((withdrawnToDate/1e18)).to.be.below(2);
    });

    it("Staker 3 Withdraws their share of interest at 3000 seconds", async () => {

      let beforePlotBal = await plotusToken.balanceOf(S3);

      // increase time
      await increaseTimeTo(stakeStartTime + 3000);

      let interest = (Math.round((await staking.calculateInterest(S3))[0]/1e18));
      
      await staking.withdrawInterest( {
        from: S3
      });

      let afterPlotBal = await plotusToken.balanceOf(S3);

      expect((Math.abs((afterPlotBal - beforePlotBal)/1e18))-interest).to.be.below(10);  

      let stakerData = await staking.getStakerData(S3);
      let interestData = await staking.interestData();
      let yieldData = await staking.getYieldData(S3);

      expect((Math.round(yieldData[0][0]/1e15)).toString()).to.be.equal("110");

      // globalTotalStake
      expect((interestData[0]).toString()).to.be.equal(toWei("820", "ether")); 

      // totalStake of S3
      expect((stakerData[0]).toString()).to.be.equal(toWei("360", "ether"));
      expect((Math.abs((stakerData[1][0])/1e18)-19)).to.be.below(2);
    });

    it("Staker 2 stakes 100 Token at 4500 seconds", async () => {

      let beforeStakeTokBal = await stakeTok.balanceOf(S2);

      let beforeStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

      // increase time
      await increaseTimeTo(stakeStartTime + 4500);

      await staking.stake(toWei("100"), {
        from: S2
      });

      let afterStakeTokBal = await stakeTok.balanceOf(S2);
      let afterStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

      expect((beforeStakeTokBal - afterStakeTokBal)).to.be.equal((toWei("100", "ether"))/1);
      expect((afterStakeTokBalStaking - beforeStakeTokBalStaking)).to.be.equal((toWei("100", "ether"))/1);   

      let stakerData = await staking.getStakerData(S2);
      let interestData = await staking.interestData();
      let yieldData = await staking.getYieldData(S2);

            
      expect((Math.floor(yieldData[0]/1e15)).toString()).to.be.equal("139");
      expect((Math.floor(yieldData[1]/1e18)).toString()).to.be.equal("14");

      // globalTotalStake
      expect((interestData[0]).toString()).to.be.equal(toWei("920", "ether")); 
      
      // totalStake of S1
      expect((stakerData[0]).toString()).to.be.equal(toWei("150", "ether")); 
    });











    it("Computing updated yield data at 10000 seconds", async () => {

      // increase time
      await increaseTimeTo(stakeStartTime + 10000);

      let statsDta = await staking.getStatsData(S1);

      expect((Math.abs((Math.round((statsDta[0])/1e18)-920)))).to.be.below(2);
      expect((Math.abs((Math.round((statsDta[1][0])/1e18)-500000)))).to.be.below(2);
      expect((Math.abs((Math.round((statsDta[2][0])/1e18)-222829)))).to.be.below(2);
      expect((Math.abs((Math.round((statsDta[3][0])/1e18)-158)))).to.be.below(2);
      expect((Math.abs((Math.round((statsDta[4][0])/1e18)-74)))).to.be.below(2);

      statsDta = await staking.getStatsData(S2);

      expect((Math.abs((Math.round((statsDta[0])/1e18)-920)))).to.be.below(2);
      expect((Math.abs((Math.round((statsDta[1][0])/1e18)-500000)))).to.be.below(2);
      expect((Math.abs((Math.round((statsDta[2][0])/1e18)-81512)))).to.be.below(2);
      expect((Math.abs((Math.round((statsDta[3][0])/1e18)-158)))).to.be.below(2);
      expect((Math.abs((Math.round((statsDta[4][0])/1e18)-16)))).to.be.below(2);

      statsDta = await staking.getStatsData(S3);

      expect((Math.abs((Math.round((statsDta[0])/1e18)-920)))).to.be.below(2);
      expect((Math.abs((Math.round((statsDta[1][0])/1e18)-500000)))).to.be.below(2);
      expect((Math.abs((Math.round((statsDta[2][0])/1e18)-195634)))).to.be.below(20);
      expect((Math.abs((Math.round((statsDta[3][0])/1e18)-158)))).to.be.below(2);
      expect((Math.abs((Math.round((statsDta[4][0])/1e18)-44)))).to.be.below(5);
  
      await staking
          .updateGlobalYield()
          .catch(e => e);

      let interestData = await staking.interestData();
      let globalYieldPerToken = (await staking.getGlobalYieldsPerToken())[0];
      
      expect(((Math.round(globalYieldPerToken/1e15 - 234)))/1).to.be.below(2);
      
      // globalTotalStake
      expect(Math.abs(interestData[0]-toWei("920"))).to.be.below(100); 
      
      
      expect((Math.abs((await staking.calculateInterest(S1))/1e18) -74)).to.be.below(10);
      
      expect((Math.abs((await staking.calculateInterest(S2))/1e18) - 16)).to.be.below(10);
      
      expect((Math.abs((await staking.calculateInterest(S3))/1e18) - 44)).to.be.below(10);
    });
  });

















  describe('No one stakes in this cycle but time will increase so some interest will be generated', function() {
    it("Computing updated yield data at 20000 seconds", async () => {

      // increase time
      await increaseTimeTo(stakeStartTime + 20000);

      let statsDta = await staking.getStatsData(S1);

      expect((Math.abs((statsDta[0])/1e18)-920)).to.be.below(10);
      expect((Math.abs((statsDta[1])/1e18)-500000)).to.be.below(100);
      expect((Math.abs((statsDta[2])/1e18)-222829)).to.be.below(100);
      expect((Math.abs((statsDta[3])/1e18)-317)).to.be.below(10);
      expect((Math.abs((statsDta[4])/1e18)-144)).to.be.below(10);

      statsDta = await staking.getStatsData(S2);

      expect((Math.abs((statsDta[0])/1e18)-920)).to.be.below(10);
      expect((Math.abs((statsDta[1])/1e18)-500000)).to.be.below(100);
      expect((Math.abs((statsDta[2])/1e18)-81512)).to.be.below(100);
      expect((Math.abs((statsDta[3])/1e18)-317)).to.be.below(10);
      expect((Math.abs((statsDta[4])/1e18) - 41)).to.be.below(2);

      statsDta = await staking.getStatsData(S3);

      expect((Math.abs((statsDta[0])/1e18)-920)).to.be.below(10);
      expect((Math.abs((statsDta[1])/1e18)-5000000)).to.be.below(100);
      expect((Math.abs((statsDta[2])/1e18)-195634)).to.be.below(100);
      expect((Math.abs((statsDta[3])/1e18)-317)).to.be.below(10);
      expect((Math.abs((statsDta[4])/1e18)-106)).to.be.below(10);
 
      await staking
          .updateGlobalYield()
          .catch(e => e);
      
      let interestData = await staking.interestData();
      
   
      expect((Math.abs(interestData[1]/1e15)-406)).to.be.below(10);

      // globalTotalStake
      expect(Math.abs(interestData[0])-toWei("920")).to.be.below(10); 
      

      
      expect((Math.abs((await staking.calculateInterest(S1))/1e18)-144)).to.be.below(10);
      
      expect((Math.abs((await staking.calculateInterest(S2))/1e18) - 41)).to.be.below(10);
      
      expect((Math.abs((await staking.calculateInterest(S3))/1e18)-106)).to.be.below(10);
    });
  });

  describe('Few stakers stakes and few staker withdraw Interest and stake', function() {
    it("Staker 1 Withdraws partial stake worth 150 Token at 25000 seconds", async () => {

      let beforestakeTokBal = await stakeTok.balanceOf(S1);
      let beforePlotBal = await plotusToken.balanceOf(S1);

      let beforestakeTokBalStaking = await stakeTok.balanceOf(staking.address);
      let beforePlotBalStaking = await plotusToken.balanceOf(staking.address);

      // increase Time
      await increaseTimeTo(stakeStartTime + 25000);

      
      await staking.withdrawStakeAndInterest(toWei("150"), {
          from: S1
          });
        
        let afterstakeTokBal = await stakeTok.balanceOf(S1);
        let afterPlotBal = await plotusToken.balanceOf(S1);

        let afterstakeTokBalStaking = await stakeTok.balanceOf(staking.address);
        let afterPlotBalStaking = await plotusToken.balanceOf(staking.address);

        expect((Math.abs((afterPlotBal - beforePlotBal)/1e18)-180)).to.be.below(10);
        expect((Math.abs((beforePlotBalStaking - afterPlotBalStaking)/1e18)-180)).to.be.below(10); 
        expect((Math.abs((afterstakeTokBal - beforestakeTokBal)/1e18)-150)).to.be.below(10);
        expect((Math.abs((beforestakeTokBalStaking - afterstakeTokBalStaking)/1e18-150))).to.be.below(10); 

        let stakerData = await staking.getStakerData(S1);
        let interestData = await staking.interestData();
        let yieldData = await staking.getYieldData(S1);
        
        expect((Math.abs(yieldData[0]/1e15)-492)).to.be.below(10);
        expect((Math.abs(yieldData[1]/1e18)-128)).to.be.below(10);

        // globalTotalStake
        expect(Math.abs(interestData[0]-toWei("770", "ether"))).to.be.below(1000); 
        
        // totalStake of S1
        expect(Math.abs(stakerData[0])-toWei("260", "ether")).to.be.below(1000); 
    });

    it("Staker 2 Withdraws Entire stake worth 150 Token at 30000 seconds", async () => {

      let beforestakeTokBal = await stakeTok.balanceOf(S2);
      let beforePlotBal = await plotusToken.balanceOf(S2);

      let beforestakeTokBalStaking = await stakeTok.balanceOf(staking.address);
      let beforePlotBalStaking = await plotusToken.balanceOf(staking.address);

      // increase Time
      await increaseTimeTo(stakeStartTime + 30000);

      let stakerDataS2 = await staking.getStakerData(S2);
      let interestS2 = await staking.calculateInterest(S2);

      await staking.withdrawStakeAndInterest(toWei("150"), {
          from: S2
          });

      

      let afterstakeTokBal = await stakeTok.balanceOf(S2);
      let afterPlotBal = await plotusToken.balanceOf(S2);
      let afterstakeTokBalStaking = await stakeTok.balanceOf(staking.address);
      let afterPlotBalStaking = await plotusToken.balanceOf(staking.address);

      expect((Math.abs((afterPlotBal - beforePlotBal)/1e18-70))).to.be.below(5);
      expect((Math.abs((beforePlotBalStaking - afterPlotBalStaking)/1e18-70))).to.be.below(5);
      expect((Math.abs((afterstakeTokBal - beforestakeTokBal)/1e18-150))).to.be.below(10);
      expect((Math.abs((beforestakeTokBalStaking - afterstakeTokBalStaking)/1e18-150))).to.be.below(10); 

      let stakerData = await staking.getStakerData(S2);
      let interestData = await staking.interestData();
      let yieldData = await staking.getYieldData(S2);
    
      expect((Math.abs(yieldData[0]/1e15-595))).to.be.below(20);
      expect((Math.abs(yieldData[1]/1e18))).to.be.below(20);

      // globalTotalStake
      expect(Math.abs(interestData[0])).to.be.equal(toWei("620", "ether")/1); 
      
      // totalStake of S2
      expect(Math.abs(stakerData[0])).to.be.equal(toWei("0", "ether")/1);    
    });

    it("Staker 3 stakes 100 Token at 100000 seconds", async () => {

      let beforeStakeTokBal = await stakeTok.balanceOf(S3);
      let beforeStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

      // increase time
      await increaseTimeTo(stakeStartTime + 100000);
      
      await staking.stake(toWei("100"), {
          from: S3
        });

        let afterStakeTokBal = await stakeTok.balanceOf(S3);

        let afterStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

        expect(Math.abs((beforeStakeTokBal - afterStakeTokBal)-toWei("100"))).to.be.below(10);
        expect(Math.abs((afterStakeTokBalStaking - beforeStakeTokBalStaking)-toWei("100"))).to.be.below(10); 

        let stakerData = await staking.getStakerData(S3);
        let interestData = await staking.interestData();
        let yieldData = await staking.getYieldData(S3);

          
        expect((Math.abs(yieldData[0]/1e16)-238)).to.be.below(10);
        expect((Math.abs(yieldData[1]/1e18)-258)).to.be.below(10);

        // globalTotalStake
        expect(Math.abs(interestData[0]-toWei("720"))).to.be.below(100); 
        

        // totalStake of S3
        expect(Math.abs(stakerData[0]-toWei("460", "ether"))).to.be.below(100); 
    });
    it("Staker 1 stakes 100 Token at 700000th seconds", async () => {

      let beforeStakeTokBal = await stakeTok.balanceOf(S1);

      let beforeStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

      // increase block
      await increaseTimeTo(stakeStartTime + 700000);

      
      await staking.stake(toWei("100"), {
          from: S1
        });

        let afterStakeTokBal = await stakeTok.balanceOf(S1);

        let afterStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

        expect(Math.abs((beforeStakeTokBal - afterStakeTokBal)-toWei("100"))).to.be.below(2);
        expect((afterStakeTokBalStaking - beforeStakeTokBalStaking)).to.be.equal((toWei("100"))/1); 

        let stakerData = await staking.getStakerData(S1);
        let interestData = await staking.interestData();
        let yieldData = await staking.getYieldData(S1);

          
        expect((Math.floor(yieldData[0]/1e18)).toString()).to.be.equal("15");
        expect((Math.floor(yieldData[1]/1e18)).toString()).to.be.equal("1687");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(toWei("820")); 
        

        // totalStake of S1
        expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("360", "ether")); 
    });

    it("Computing updated yield data at 31536000 seconds", async () => {

      // increase time
      await increaseTimeTo(stakeStartTime + 31536000);

      let statsDta = await staking.getStatsData(S1);

      expect((Math.abs((statsDta[0])/1e18)-820)).to.be.below(10);
      expect((Math.abs((statsDta[1])/1e18)-500000)).to.be.below(100);
      expect((Math.abs((statsDta[2])/1e18)-218567)).to.be.below(100);
      expect((Math.abs((statsDta[3])/1e18)-500000)).to.be.below(100);
      expect((Math.abs((statsDta[4])/1e18)-218567)).to.be.below(100);

      statsDta = await staking.getStatsData(S2);

      expect((Math.abs((statsDta[0])/1e18)-820)).to.be.below(10);
      expect((Math.abs((statsDta[1])/1e18)-500000)).to.be.below(100);
      expect((Math.abs((statsDta[2])/1e18))).to.be.below(2);
      expect((Math.abs((statsDta[3])/1e18)-500000)).to.be.below(100);
      expect((Math.abs((statsDta[4])/1e18))).to.be.below(2);

      statsDta = await staking.getStatsData(S3);

      expect((Math.abs((statsDta[0])/1e18)-820)).to.be.below(10);
      expect((Math.abs((statsDta[1])/1e18)-500000)).to.be.below(100);
      expect((Math.abs((statsDta[2])/1e18)-281158)).to.be.below(100);
      expect((Math.abs((statsDta[3])/1e18)-500000)).to.be.below(100);
      expect((Math.abs((statsDta[4])/1e18)-281158)).to.be.below(100);

         
      await staking
          .updateGlobalYield()
          .catch(e => e);

      let interestData = await staking.interestData();
          
      expect((Math.abs(interestData[1]/1e18)-611)).to.be.below(10);

      // globalTotalStake
      expect(Math.abs(interestData[0]-toWei("820", "ether"))).to.be.below(10); 
    
      
      expect((Math.abs((await staking.calculateInterest(S1))/1e18)-218567)).to.be.below(100);
      
      expect((Math.abs((await staking.calculateInterest(S2))/1e18))).to.be.below(2);
      
      expect((Math.abs((await staking.calculateInterest(S3))/1e18)-281158)).to.be.below(100);
    });
   });

  describe('Stakers can unstake even after 365 days', function() {
    it("All stakers unstake thier entire stake after 365 days", async () => {

      let beforestakeTokBalS1 = await stakeTok.balanceOf(S1);
      let beforePlotBalS1 = await plotusToken.balanceOf(S1);

      let beforestakeTokBalS3 = await stakeTok.balanceOf(S3);
      let beforePlotBalS3 = await plotusToken.balanceOf(S3);


      // increase time
      await increaseTimeTo(stakeStartTime + 31968000);

      await staking.withdrawStakeAndInterest(toWei("360"), {
        from: S1
      });

      await staking.withdrawStakeAndInterest(toWei("460"), {
        from: S3
      });

      let afterstakeTokBalS1 = await stakeTok.balanceOf(S1);
      let afterPlotBalS1 = await plotusToken.balanceOf(S1);

      let afterstakeTokBalS3 = await stakeTok.balanceOf(S3);
      let afterPlotBalS3 = await plotusToken.balanceOf(S3);

      let afterstakeTokBalStaking = await stakeTok.balanceOf(staking.address);
      let afterPlotBalStaking = await plotusToken.balanceOf(staking.address);

      expect((Math.abs((afterPlotBalS1 - beforePlotBalS1)/1e18)-218567)).to.be.below(100);
      expect((Math.abs((afterPlotBalS3 - beforePlotBalS3)/1e18)-281158)).to.be.below(100);
      expect((Math.abs((afterPlotBalStaking)/1e18))).to.be.below(2); 

      expect((Math.abs((afterstakeTokBalS1 - beforestakeTokBalS1)/1e18)-360)).to.be.below(10);
      expect((Math.abs((afterstakeTokBalS3 - beforestakeTokBalS3)/1e18)-460)).to.be.below(10);
      expect((Math.abs((afterstakeTokBalStaking)/1e18))).to.be.below(2);
      
      let interestData = await staking.interestData();
      let globalYieldsPerToken = await staking.getGlobalYieldsPerToken();
      
          
      expect((Math.abs(globalYieldsPerToken[0]/1e18-611))).to.be.below(10);

      // globalTotalStake
      expect(interestData[0].toString()).to.be.equal("0"); 
      expect((Math.abs((await staking.calculateInterest(S1))/1e18))).to.be.below(2);
      expect((Math.abs((await staking.calculateInterest(S2))/1e18))).to.be.below(2);
      expect((Math.abs((await staking.calculateInterest(S3))/1e18))).to.be.below(2);

      let statsDta = await staking.getStatsData(S1);
      expect((Math.abs((statsDta[0])/1e18))).to.be.below(2);
      expect((Math.abs((statsDta[1])/1e18)-500000)).to.be.below(100);
      expect((Math.abs((statsDta[2])/1e18))).to.be.below(2);
      expect((Math.abs((statsDta[3])/1e18)-500000)).to.be.below(100);
      expect((Math.abs((statsDta[4])/1e18))).to.be.below(2);
    });
    it("Should revert if tries to stake 0 amount", async () => {

      await assertRevert(staking.stake(0, {
              from: S1
            }));
    });
    it("Should revert if tries to stake after 365 days", async () => {

      await assertRevert(staking.stake(10, {
              from: S1
            }));
    });
    it("Should revert if tries to unstake 0 amount", async () => {

      await assertRevert(staking.withdrawStakeAndInterest(0, {
              from: S1
            }));
    });
    it("Should revert if tries to unstake more than staked", async () => {

      await assertRevert(staking.withdrawStakeAndInterest(10, {
              from: S1
            }));
    });
  });
  describe('reverts', function() {
    it("Should revert if transer token failed while staking", async () => {

      await assertRevert(dummyStaking.stake(100, {
        from: S1
      }));
    });
    it("Should revert if transfer token failed while transfering to vault", async () => {

      await assertRevert(dummyStaking.updateGlobalYield( {
        from: S1
      }));
      
    });

    it("Should revert if transer token failed while unstaking", async () => {
      await dummyStaking.addStake(S1, 200);
      await dummyStaking.setInterestData(200, toWei("10"), 0);
      await dummyRewardTok.setRetBit(true);
      await dummyStaking.setStarttime();
      await assertRevert(dummyStaking.withdrawStakeAndInterest(100, {
        from: S1
      }));
    });
    it("Should revert if transer token failed while withdrawing interest", async () => {
      await dummyStaking.setInterestData(200, toWei("10"), 0);
      await dummyRewardTok.setRetBit(false);
      await assertRevert(dummyStaking.withdrawInterest( {
        from: S1
      }));
    });
    it("Should return 0 if withdrawnTodate+stakebuin > globalyieldxstaked", async () => {
      await dummyStaking.setBuyInRate(S1, toWei("2000000"), 0);
      expect((Math.floor((await dummyStaking.calculateInterest(S1))/1e18)).toString()).to.be.equal("0");
      await dummyStaking.setInterestData(200, 0, 0);
      let statsDta = await dummyStaking.getStatsData(S1);
      expect((Math.floor((statsDta[2][0])/1e18)).toString()).to.be.equal("0");
      expect((Math.floor((statsDta[4][0])/1e18)).toString()).to.be.equal("0");
    });
    
    
    it("Should Revert if staking period pass as 0", async () => {
      let nowTime = await latestTime();
      await assertRevert(MultiRewardsStaking.new(stakeTok.address, [plotusToken.address], 0, [toWei("500000")], nowTime,vaultAdd));
    });
    it("Should Revert if reward pass as 0", async () => {
      let nowTime = await latestTime();
      await assertRevert(MultiRewardsStaking.new(stakeTok.address, [plotusToken.address], 120, [0], nowTime,vaultAdd));
    });
    it("Should Revert if start time pass as past time", async () => {
      let nowTime = await latestTime();
      await assertRevert(MultiRewardsStaking.new(stakeTok.address, [plotusToken.address], 1, [120], nowTime-1500,vaultAdd));
    });
    it("Should Revert if stake token is null", async () => {
      let nowTime = await latestTime();
      await assertRevert(MultiRewardsStaking.new(nullAddress, [plotusToken.address], 1, [120], nowTime,vaultAdd));
    });
    it("Should Revert if reward token is null", async () => {
      let nowTime = await latestTime();
      await assertRevert(MultiRewardsStaking.new(stakeTok.address, [nullAddress], 1, [120], nowTime,vaultAdd));
    });
    it("Should Revert if vault address is null", async () => {
      let nowTime = await latestTime();
      await assertRevert(MultiRewardsStaking.new(stakeTok.address, [plotusToken.address], 1, [120], nowTime, nullAddress));
    });
  });

});











contract("InterestDistribution - Scenario5 All staker unstakes before stake period and no one stakes.", ([S1, S2, S3, vaultAdd]) => {
  let stakeTok,
      plotusToken,
      staking,
      stakeStartTime;

    before(async () => {
      
      stakeTok = await UniswapETH_Plot.new("UEP","UEP");
      plotusToken = await PlotusToken.new(toWei("30000000"), S1);
      staking = await MultiRewardsStaking.new(stakeTok.address, [plotusToken.address], 3600*24*365, [toWei("500000")], (await latestTime())/1 + 1, vaultAdd);

      await plotusToken.transfer(staking.address, toWei("500000"));

      
      await stakeTok.mint(S1, toWei("1000"));
      await stakeTok.mint(S2, toWei("1000"));
      await stakeTok.mint(S3, toWei("1000"));
      await stakeTok.approve(staking.address, toWei("10000", "ether"), {
        from: S1
      });
      await stakeTok.approve(staking.address, toWei("10000", "ether"), {
        from: S2
      });
      await stakeTok.approve(staking.address, toWei("10000", "ether"), {
        from: S3
      });

      stakeStartTime = (await staking.stakingStartTime())/1;
      console.log("starttime: ", stakeStartTime);
    });
  describe('All staker unstakes before staking period and no one stakes', function() {
    
    it("Staker 1 staked 100 tokens at 864000th seconds", async () => {

      let beforeStakeTokBal = await stakeTok.balanceOf(S1);
      let beforeStakeTokBalStaking = await stakeTok.balanceOf(staking.address);
      let vaultBal = await plotusToken.balanceOf(vaultAdd);
      // increase block
      await increaseTimeTo(stakeStartTime + 864000);
      /**
        * S1 stakes 100 tokens
        */
        await staking.stake(toWei("100"), {
          from: S1
        });

        let vaultBalAfter = await plotusToken.balanceOf(vaultAdd);

        let afterStakeTokBal = await stakeTok.balanceOf(S1);

        let afterStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

        expect(((beforeStakeTokBal - afterStakeTokBal)).toString()).to.be.equal(toWei("100"));
        expect(((afterStakeTokBalStaking - beforeStakeTokBalStaking)).toString()).to.be.equal(toWei("100")); 
        expect((Math.abs((vaultBalAfter - vaultBal)/1e18-13698))).to.be.below(100);


        let stakerData = await staking.getStakerData(S1);
        let interestData = await staking.interestData();
        let yieldData = await staking.getYieldData(S1);

        // 1st stake so globalTotalStake is 0, hence 
        // globalYieldPerToken and gdYieldRate are  0.
        expect((yieldData[0]).toString()).to.be.equal("0");
        expect((yieldData[1]).toString()).to.be.equal("0");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(toWei("100")); 
        

        // totalStake of S1
        expect((stakerData[0]).toString()).to.be.equal(toWei("100")); 
    });

    it("Staker 2 stakes 50 Token at 4320000th seconds", async () => {

      let beforeStakeTokBal = await stakeTok.balanceOf(S2);

      let beforeStakeTokBalStaking = await stakeTok.balanceOf(staking.address);
      
      // increase block
      await increaseTimeTo(stakeStartTime + 4320000);


      /**
        * S2 stakes 50 tokens
        */
        await staking.stake(toWei("50"), {
          from: S2
        });


        let afterStakeTokBal = await stakeTok.balanceOf(S2);

        let afterStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

        expect((beforeStakeTokBal - afterStakeTokBal)).to.be.equal((toWei("50", "ether"))/1);
        expect((afterStakeTokBalStaking - beforeStakeTokBalStaking)).to.be.equal((toWei("50", "ether"))/1); 

        let stakerData = await staking.getStakerData(S2);
        let interestData = await staking.interestData();
        let yieldData = await staking.getYieldData(S2);
        expect((Math.abs(yieldData[0]/1e18-547))).to.be.below(10);
        expect(((Math.abs(yieldData[1]/1e18-27397)))).to.be.below(100);

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("150", "ether")); 

        // totalStake of S2
        expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("50", "ether")); 
 
    });

    it("Staker 3 stakes 360 Token at 12960000th seconds", async () => {

      
      let beforeStakeTokBal = await stakeTok.balanceOf(S3);

      let beforeStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

      // increase block
      await increaseTimeTo(stakeStartTime + 12960000);
      
      await staking.stake(toWei("360"), {
          from: S3
        });

        let afterStakeTokBal = await stakeTok.balanceOf(S3);

        let afterStakeTokBalStaking = await stakeTok.balanceOf(staking.address);

        expect(Math.abs(beforeStakeTokBal - afterStakeTokBal - toWei("360", "ether"))).to.be.below(100);
        expect(Math.abs(afterStakeTokBalStaking - beforeStakeTokBalStaking- toWei("360", "ether"))).to.be.below(100);  

        let stakerData = await staking.getStakerData(S3);
        let interestData = await staking.interestData();
        let yieldData = await staking.getYieldData(S3);
   
        expect((Math.abs(yieldData[0]/1e18-1461))).to.be.below(10);
        expect((Math.abs(yieldData[1]/1e18-526027))).to.be.below(100);

        // globalTotalStake
        expect(Math.abs(interestData[0]-toWei("510"))).to.be.below(100); 
        
        // totalStake of S3
        expect(Math.abs(stakerData[0])).to.be.equal(toWei("360")/1); 
        
    });

    it("Staker 1 Withdraws Entire stake worth 100 Token at 17280000th seconds", async () => {

      let beforestakeTokBal = await stakeTok.balanceOf(S1);
      let beforePlotBal = await plotusToken.balanceOf(S1);

      let beforestakeTokBalStaking = await stakeTok.balanceOf(staking.address);
      let beforePlotBalStaking = await plotusToken.balanceOf(staking.address);

      // increase block
      await increaseTimeTo(stakeStartTime + 17280000);

      await staking.withdrawStakeAndInterest(toWei("100"), {
          from: S1
          });

      let afterstakeTokBal = await stakeTok.balanceOf(S1);
      let afterPlotBal = await plotusToken.balanceOf(S1);

      let afterstakeTokBalStaking = await stakeTok.balanceOf(staking.address);
      let afterPlotBalStaking = await plotusToken.balanceOf(staking.address);

      expect((Math.abs((afterPlotBal - beforePlotBal)/1e18-159548))).to.be.below(100);
      expect((Math.abs((beforePlotBalStaking - afterPlotBalStaking)/1e18-159548))).to.be.below(100); 

      expect((Math.floor((afterstakeTokBal - beforestakeTokBal)/1e18)).toString()).to.be.equal("100");
      expect((Math.floor((beforestakeTokBalStaking - afterstakeTokBalStaking)/1e18)).toString()).to.be.equal("100"); 

      let stakerData = await staking.getStakerData(S1);
      let interestData = await staking.interestData();
      let yieldData = await staking.getYieldData(S1);

    
      expect((Math.abs(yieldData[0]/1e18-1595))).to.be.below(100);
      expect((Math.floor(yieldData[1]/1e18)).toString()).to.be.equal("0");

      // globalTotalStake
      expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("410", "ether")); 
      
      // totalStake of S2
      expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("0", "ether"));    
    });

    it("Staker 2 Withdraws Entire stake worth 50 Token at 21600000th seconds", async () => {

      let beforestakeTokBal = await stakeTok.balanceOf(S2);
      let beforePlotBal = await plotusToken.balanceOf(S2);

      let beforestakeTokBalStaking = await stakeTok.balanceOf(staking.address);
      let beforePlotBalStaking = await plotusToken.balanceOf(staking.address);

      // increase block
      await increaseTimeTo(stakeStartTime + 21600000);


      await staking.withdrawStakeAndInterest(toWei("50"), {
          from: S2
          });

      let afterstakeTokBal = await stakeTok.balanceOf(S2);
      let afterPlotBal = await plotusToken.balanceOf(S2);

      let afterstakeTokBalStaking = await stakeTok.balanceOf(staking.address);
      let afterPlotBalStaking = await plotusToken.balanceOf(staking.address);

      expect((Math.abs((afterPlotBal - beforePlotBal)/1e18-60729))).to.be.below(100);
      expect((Math.abs((beforePlotBalStaking - afterPlotBalStaking)/1e18-60729))).to.be.below(100); 

      expect((Math.floor((afterstakeTokBal - beforestakeTokBal)/1e18)).toString()).to.be.equal("50");
      expect((Math.floor((beforestakeTokBalStaking - afterstakeTokBalStaking)/1e18)).toString()).to.be.equal("50"); 

      let stakerData = await staking.getStakerData(S2);
      let interestData = await staking.interestData();
      let yieldData = await staking.getYieldData(S2);

    
      expect((Math.abs(yieldData[0]/1e18-1762))).to.be.below(100);
      expect((Math.floor(yieldData[1]/1e18)).toString()).to.be.equal("0");

      // globalTotalStake
      expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("360", "ether")); 
      
      // totalStake of S2
      expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("0", "ether"));    
    });
    





    it("Staker 3 Withdraws Entire stake worth 360 Token at 25920000th seconds", async () => {

      let beforestakeTokBal = await stakeTok.balanceOf(S3);
      let beforePlotBal = await plotusToken.balanceOf(S3);

      let beforestakeTokBalStaking = await stakeTok.balanceOf(staking.address);
      let beforePlotBalStaking = await plotusToken.balanceOf(staking.address);

      // increase block
      await increaseTimeTo(stakeStartTime + 25920000);


      await staking.withdrawStakeAndInterest(toWei("360"), {
          from: S3
          });

      let afterstakeTokBal = await stakeTok.balanceOf(S3);
      let afterPlotBal = await plotusToken.balanceOf(S3);
      let afterstakeTokBalStaking = await stakeTok.balanceOf(staking.address);
      let afterPlotBalStaking = await plotusToken.balanceOf(staking.address);


      expect((Math.abs((afterPlotBal - beforePlotBal)/1e18-176981))).to.be.below(100);
      expect((Math.abs((beforePlotBalStaking - afterPlotBalStaking)/1e18 -176981))).to.be.below(100); 

      expect((Math.floor((afterstakeTokBal - beforestakeTokBal)/1e18)).toString()).to.be.equal("360");
      expect((Math.floor((beforestakeTokBalStaking - afterstakeTokBalStaking)/1e18)).toString()).to.be.equal("360"); 

      let stakerData = await staking.getStakerData(S3);
      let interestData = await staking.interestData();
      let yieldData = await staking.getYieldData(S3);

    
      expect((Math.abs(yieldData[0]/1e18-1952))).to.be.below(10);
      expect((Math.floor(yieldData[1]/1e18)).toString()).to.be.equal("0");

      // globalTotalStake
      expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("0", "ether")); 
      
      // totalStake of S2
      expect((stakerData[0]).toString()).to.be.equal(web3.utils.toWei("0", "ether"));    
    });

    it("Computing updated yield data at 31536000th seconds", async () => {

      let vaultBal = await plotusToken.balanceOf(vaultAdd);

      // increase block
      await increaseTimeTo(stakeStartTime + 31536000);
          
      await staking
          .updateGlobalYield()
          .catch(e => e);

      let vaultBalAfter = await plotusToken.balanceOf(vaultAdd);

      expect((Math.abs((vaultBalAfter - vaultBal)/1e18-89041))).to.be.below(100);

      
      let interestData = await staking.interestData();
      let globalYieldsPerToken = await staking.getGlobalYieldsPerToken();
            
      expect(((Math.abs(globalYieldsPerToken[0]/1e18-1952)))).to.be.below(10);


      // globalTotalStake
      expect((interestData[0]).toString()).to.be.equal(web3.utils.toWei("0", "ether")); 
      
      
      expect((Math.floor((await staking.calculateInterest(S1))/1e18)).toString()).to.be.equal("0");
      
      expect((Math.floor((await staking.calculateInterest(S2))/1e18)).toString()).to.be.equal("0");
      
      expect((Math.floor((await staking.calculateInterest(S3))/1e18)).toString()).to.be.equal("0");
    });
   });
 });














 contract("InterestDistribution - Scenario based calculations for staking model with 2 rewards token", ([S1, S2, S3, vaultAdd]) => {
  let stakeTok,
      rewardToken1,
      rewardToken2,
      staking,
      stakeStartTime,
      stakingPeriod,
      rewardToBeDistributed1,
      rewardToBeDistributed2;

    before(async () => {
      
      stakeTok = await UniswapETH_Plot.new("UEP","UEP");
      rewardToken1 = await PlotusToken.new(toWei("30000000"), S1);
      rewardToken2 = await PlotusToken.new(toWei("50000000"), S1);
      let nowTime = await latestTime();
      stakingPeriod = (24*3600*365);
      rewardToBeDistributed1 = toWei("500000");
      rewardToBeDistributed2 = toWei("700000");
      staking = await MultiRewardsStaking.new(stakeTok.address, [rewardToken1.address, rewardToken1.address], stakingPeriod, [rewardToBeDistributed1, rewardToBeDistributed2], (await latestTime())/1 + 1, vaultAdd);

      await rewardToken1.transfer(staking.address, rewardToBeDistributed1);
      await rewardToken2.transfer(staking.address, rewardToBeDistributed2);

      
      await stakeTok.mint(S1, toWei("1000"));
      await stakeTok.mint(S2, toWei("1000"));
      await stakeTok.mint(S3, toWei("1000"));
      await stakeTok.approve(staking.address, toWei("10000", "ether"), {
        from: S1
      });
      await stakeTok.approve(staking.address, toWei("10000", "ether"), {
        from: S2
      });
      await stakeTok.approve(staking.address, toWei("10000", "ether"), {
        from: S3
      });

      stakeStartTime = (await staking.stakingStartTime())/1;
      console.log("starttime: ", stakeStartTime);
      
    });
  describe('Multiple Staker stakes, no withdrawal', function() {
    
    it("Staker 1 stakes 100 Token after 10 seconds", async () => {

      let beforeStakeTokBal = await stakeTok.balanceOf(S1);
      let beforeStakeTokBalStaking = await stakeTok.balanceOf(staking.address);
      let vaultBal = await rewardToken1.balanceOf(vaultAdd);
      
      // increase 10 seconds
      await increaseTimeTo(stakeStartTime + 10);


      /**
        * S1 stakes 100 tokens
        */
        await staking.stake(toWei("100"), {
          from: S1
        });
        let vaultBalAfter = await rewardToken1.balanceOf(vaultAdd);
        let afterStakeTokBal = await stakeTok.balanceOf(S1);

        let afterStakeTokBalStaking = await stakeTok.balanceOf(staking.address);
        expect((beforeStakeTokBal - afterStakeTokBal)).to.be.equal((toWei("100", "ether"))/1);
        expect((afterStakeTokBalStaking - beforeStakeTokBalStaking)).to.be.equal((toWei("100", "ether"))/1); 

        // accuraccy is of 2 sec
        let vaultbalanceExpectedInf =  (rewardToBeDistributed1/ stakingPeriod +  rewardToBeDistributed2/ stakingPeriod) *10 ;
        let vaultbalanceExpectedSup = (rewardToBeDistributed1/ stakingPeriod +  rewardToBeDistributed2/ stakingPeriod) *12 ;
        
        expect((Math.abs((vaultbalanceExpectedSup - (vaultBalAfter - vaultBal))))).to.be.below(vaultbalanceExpectedSup-vaultbalanceExpectedInf + 10); 

        let stakerData = await staking.getStakerData(S1);
        let interestData = await staking.interestData();
        let yieldData = await staking.getYieldData(S1);
        let globalYieldsPerToken = await staking.getGlobalYieldsPerToken();

        // 1st stake so globalTotalStake is 0, hence 
        // globalYieldPerToken and gdYieldRate are  0.
        expect((yieldData[0][0]).toString()).to.be.equal("0");
        expect((yieldData[1][0]).toString()).to.be.equal("0");
        expect((yieldData[0][1]).toString()).to.be.equal("0");
        expect((yieldData[1][1]).toString()).to.be.equal("0");
        expect((globalYieldsPerToken[0]).toString()).to.be.equal("0");
        expect((globalYieldsPerToken[1]).toString()).to.be.equal("0");

        // globalTotalStake
        expect((interestData[0]).toString()).to.be.equal(toWei("100", "ether")); 

        // totalStake of S1
        expect((stakerData[0]).toString()).to.be.equal(toWei("100", "ether")); 

    });

    it("Computing updated yield data at 10000 seconds", async () => {

      // increase time
      await increaseTimeTo(stakeStartTime + 10000);

      let statsDta = await staking.getStatsData(S1);

      expect((Math.abs((Math.round((statsDta[0])/1e18)-100)))).to.be.below(2);
      expect((Math.abs((Math.round((statsDta[1][0])/1e18)-500000)))).to.be.below(100);
      expect((Math.abs((Math.round((statsDta[2][0])/1e18)-500000)))).to.be.below(100);
      expect((Math.abs((Math.round((statsDta[3][0])/1e18)-158)))).to.be.below(10);
      expect((Math.abs((Math.round((statsDta[4][0])/1e18)-158)))).to.be.below(10);

      expect((Math.abs((Math.round((statsDta[0])/1e18)-100)))).to.be.below(2);
      expect((Math.abs((Math.round((statsDta[1][1])/1e18)-700000)))).to.be.below(100);
      expect((Math.abs((Math.round((statsDta[2][1])/1e18)-700000)))).to.be.below(100);
      expect((Math.abs((Math.round((statsDta[3][1])/1e18)-222)))).to.be.below(10);
      expect((Math.abs((Math.round((statsDta[4][1])/1e18)-222)))).to.be.below(10);

         
      await staking
          .updateGlobalYield()
          .catch(e => e);

      let interestData = await staking.interestData();
      let globalYieldPerToken = await staking.getGlobalYieldsPerToken();
      
      expect(((Math.abs(globalYieldPerToken[0]/1e15 - 1600)))/1).to.be.below(100);
      
      // globalTotalStake
      expect(Math.abs(interestData[0]-toWei("100"))).to.be.below(100); 
      expect((Math.abs((await staking.calculateInterest(S1))[0]/1e18) - 160)).to.be.below(10);
      expect((Math.abs((await staking.calculateInterest(S1))[1]/1e18) - 221)).to.be.below(10);
    });
  });
});