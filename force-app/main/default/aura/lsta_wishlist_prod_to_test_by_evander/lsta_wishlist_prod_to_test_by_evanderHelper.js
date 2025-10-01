/************************************************************************************************************
 * @filename        : PartOrderMyPartListHelper.js
 * @projectname     :
 * @author          : xanitus@windmillsoft.kr / 최명호(K)
 * @date            : 2023.10.05
 * @group           :
 * @group-content   :
 * @description     : 
 * @tester          :
 * @reference       :
 * @copyright       : 
 * @modification Log
 * ==========================================================================================================
 *  ver     date        author      description
 * ==========================================================================================================
    0.1     2023.10.05  K(xanitus)  create 
    0.2     2023.11.10  K(xanitus)  myPartsListColumns > 필드 Quantity__c 를 수정 할 수 있도록 한다
                                    업로드 양식 변경
    0.3     2023.11.15  K(xanitus)  리스트가 MyPartList 에서 표준개체인 WishList 로 변경됨에 따라 수정됨
                        K(xanitus)  목록 추가를 찜 목록 추가 및 장바구니 추가로 분리한다.    
    0.4     2023.11.22  K(xanitus)  단가 추가                                                        
 ************************************************************************************************************/
({
    setDataTables : function(component) {
        var isDistributor = component.get('v.isDistributor');
        var myPartsListColumns = [
            {label: '판매상태'          , fieldName: 'SalesStatus'    , type: 'text'      , initialWidth: 100},
            {label: '자재번호'          , fieldName: 'PartNumber'     , type: 'text'      , initialWidth: 100, cellAttributes: { alignment: 'center' }},
            {label: '기존자재번호'      , fieldName: 'OldPartNumber'  , type: 'text'      , initialWidth: 150},
            {label: '자재내역'          , fieldName: 'ProductName'    , type: 'text'      , initialWidth: 300, wrapText: true},
            {label: '수량'              , fieldName: 'Quantity__c'    , type: 'number'    , initialWidth: 160, editable: true}
        ];
        if(isDistributor){
            myPartsListColumns.push({label: '총판가(VAT제외)'              , fieldName: 'UnitPrice'      , type: 'currency'  , initialWidth: 150});
        }else{
            myPartsListColumns.push({label: '단가(VAT포함)'              , fieldName: 'VAT_Include_UnitPrice'      , type: 'currency'  , initialWidth: 150});
        }
        myPartsListColumns.push({label: '청구 금액'         , fieldName: 'Amount'          , type: 'currency'  , initialWidth: 100});
        myPartsListColumns.push({label: '최근 주문일'       , fieldName: 'LastOrderedDate' , type: 'text'      , initialWidth: 110, cellAttributes: { alignment: 'center' }});
        myPartsListColumns.push({label: '최근 주문 수량'    , fieldName: 'LastQuantity'    , type: 'number'    , initialWidth: 130, cellAttributes: { alignment: 'right' }});
        myPartsListColumns.push({label: '최초 찜 등록일'    , fieldName: 'FirstCreatedDate', type: 'text'      , initialWidth: 130, cellAttributes: { alignment: 'center' }});
        myPartsListColumns.push({label: '모델 명'           , fieldName: 'ModelName'       , type: 'text'      , initialWidth: 200, wrapText: true});
        myPartsListColumns.push({label: '참고 사항'         , fieldName: 'REF'             , type: 'text'      , initialWidth: 150, wrapText: true});
        myPartsListColumns.push({label: '비고'              , fieldName: 'Remark'          , type: 'text'      , initialWidth: 150, wrapText: true});

        component.set('v.myPartsListColumns', myPartsListColumns);
        component.set('v.partsToAddToMyPartsListColumns', [
            {label: '선택'          , fieldName: 'NameKorean__c', type: 'text'      },
            {label: '부품 번호'     , fieldName: 'Partnum__c'   , type: 'text'      },
            {label: '기존 부품 번호', fieldName: 'OldPartnum__c', type: 'text'      },
            {label: '품명'          , fieldName: 'NameEng__c'   , type: 'text'      },
            {label: '모델명'        , fieldName: ''             , type: 'text'      },
        ]);
        component.set('v.partsCloneTableColums', [
            {label: '이름', fieldName: 'Name', type: 'text' }
        ]);
    },
    toFormatDate : function(CreatedDate) {
        var date = new Date(CreatedDate);
        var year = date.getFullYear();
        var month = date.getMonth() + 1;
        var day = date.getDate();
        var formattedDate = year + '. ' + month + '. ' + day + '.';
        return formattedDate;
    },
    getMyPartsList : function(component) {
        try {
            var isDistributor = component.get('v.isDistributor');
            component.set("v.isDone",false);
            let action = component.get("c.getMyPartList");
            action.setCallback(this, function(response) {
                let responseValue = response.getReturnValue(); 
                console.log('##getMyPartsList',responseValue);
                let lists = responseValue.payload;
                lists.listWishlist.forEach(element => {
                    if(typeof element.WishlistItems != 'undefined') {
                        element.WishlistItems.forEach(row => {
                            row['ProductName'      ] = row.Product2.Part__r.NameKor__c;
                            row['SalesStatus'      ] = row.Product2.Part__r.isSalesPart__c ? '' : '판매중지';
                            row['PartNumber'       ] = row.Product2.Part__r.Partnum__c;
                            row['OldPartNumber'    ] = row.Product2.Part__r.OldPartnum__c;
                            row['NameEng'          ] = row.Product2.Part__r.NameEng__c;
                            row['UnitPrice'        ] = lists.mapPricebookEntry[row.Product2Id] != null ? lists.mapPricebookEntry[row.Product2Id].UnitPrice : 0;
                            row['VAT_Include_UnitPrice'] = lists.mapPricebookEntry[row.Product2Id] != null ? Math.round(lists.mapPricebookEntry[row.Product2Id].UnitPrice * 1.1) : 0;
                            row['Amount'           ] = isDistributor ? row.Quantity__c * row['UnitPrice'] : row.Quantity__c * row['VAT_Include_UnitPrice'];
                            row['ModelName'        ] = row.Product2.fm_Model_Names__c;
                            row['REF'              ] = row.Product2.REF__c;
                            row['LastOrderedDate'  ] = row.LastOrderedDate__c ? this.toFormatDate(row.LastOrderedDate__c) : '-';
                            row['LastQuantity'     ] = row.LastQuantity__c ? row.LastQuantity__c : 0;
                            row['FirstCreatedDate' ] = this.toFormatDate(row.CreatedDate);
                            row['Remark'           ] = row.Remark__c;
                        });
                    }
                });
                component.set("v.myPartsList", lists.listWishlist);
                this.refreshMyPartList(component);
                component.set("v.isDone",true);
            });
            $A.enqueueAction(action);
        } catch(error) {
            component.set("v.isDone",true);
            console.error('## getMyPartsList ##',error);
        }
    },
    refreshMyPartList : function(component) {
        let target = component.get("v.myPartsList");
        for(let x = 0; x < target.length; x ++ ) {
            if(target[x].Id == component.get("v.myPartsListId")) {
                component.set("v.myPartsListItem",target[x]);     
                return;
            }
        }
        component.set("v.myPartsListItem",target[0]);   
    },
    addMyPartList : function(component) {
        let mapData = {
            "name" : component.find("textMyPartsListName").get("v.value"),
            "description" : component.find("textMyPartsLisDescription").get("v.value")
        };
        component.set("v.isDone",false);
        let action = component.get("c.addMyPartList");
        action.setParams({ "mapData" : mapData});
        action.setCallback(this, function(response) {            
            let responseValue = response.getReturnValue(); 
            component.set("v.myPartsListId",responseValue.payload.Id);
            this.getMyPartsList(component);
            this.toggleMyList(component);
            component.set("v.isDone",true);
        });
        $A.enqueueAction(action);
    },
    searchPartsToAdd : function(component) {
        let target = component.find("textAddedMyPartsNo");
        let values = target.get("v.value");
        var parNumber = component.find("textAddedMyPartsNo").get("v.value").length >= 4 ? component.find("textAddedMyPartsNo").get("v.value") : '';
        var nameDescription = component.find("textAddedMyPartsName").get("v.value").length >= 2 ? component.find("textAddedMyPartsName").get("v.value") : '';
        var oldPartNumber = component.find("textAddedMyPartsNoPrev").get("v.value").length >= 4 ? component.find("textAddedMyPartsNoPrev").get("v.value") : '';
        let mapData = {
            "partNumber" : parNumber,
            "nameDescription" : nameDescription,
            "oldPartNumber" : oldPartNumber
        };
        component.set("v.isDone",false);
        let action = component.get("c.searchParts");
        action.setParams({ "mapData" : mapData});
        action.setCallback(this, function(response) {
            let responseValue = response.getReturnValue();
            console.log('## searchPartsToAdd : ', responseValue);
            component.set("v.partsList", responseValue.payload);
            component.set("v.isDoneSearch",true);
            component.set("v.isDone",true);
        });
        $A.enqueueAction(action);        
    },
    openDeleteListConfirm : function(component, event) {
        let _this_ = this;
        this.LightningConfirm.open({
            message: '목록이 삭제됩니다. 계속 하시겠습니까 ?',
            variant: 'headerless',
            label: '목록 삭제',
        }).then(function(result) {
            if(result == true) {
                _this_.deletePartList(component, event);
            }
            return result;
        });
    },
    deletePartList : function(component,event) {
        let action = component.get("c.removePartList");
        let mapData = {"Id": component.get("v.myPartsListItem").Id};
        action.setParams({ "mapData" : mapData});
        action.setCallback(this, function(response) {
            let responseValue = response.getReturnValue(); 
//          TODO : 삭제후, 첫번쨰 리스트로 이동 해야 하는가 ? 또는 다른 화면으로 이동 해야 하는가 ?
            component.set("v.myPartsListItem",component.get("v.myPartsList")[0]); 
            helper.getMyPartsList(component);
            let toastEvent = $A.get("e.force:showToast");
            toastEvent.setParams({"type": "success","title": "목록 삭제","message": "목록이 삭제 되었습니다"});
            toastEvent.fire();   
            component.set("v.isDone",true);
        });
        $A.enqueueAction(action);
    },
    toggleIsCloneMyParts : function(component) {
        component.set("v.isCloneMyParts",!component.get("v.isCloneMyParts"));
//      DESC : 장바구니를 선택 목록에서 사용 할 수 있도록 추가한다
        let myPartsList = component.get("v.myPartsList");
        let targetList = [];
//      DESC : 장바구니 복제와 찜 목록으로 복제가 분리됨        
        myPartsList.forEach(element => {
            targetList.push(element);
        });
        component.set("v.targetList",targetList);
    },
    toggleIsNewPartList : function(component) {
        component.set("v.isNewPartList",!component.get("v.isNewPartList"));
    },
    toggleIsAddPartsInPartList : function(component) {
        component.set("v.isAddPartsInPartList",!component.get("v.isAddPartsInPartList"));
    },
    toggleIsEditMyPartListName : function(component) {
        component.set("v.isEditMyPartListName",!component.get("v.isEditMyPartListName"));
    },
    addToCart: function(component, event) {
        var orderType = component.get('v.selectedOrderType');
        let partsToCart = component.get("v.partsToCart");
        console.log('## addToCart : ', partsToCart);
        if(partsToCart.length == 0) {
            let toastEvent = $A.get("e.force:showToast");
            toastEvent.setParams({"type": "error","title": "부품 선택","message": "장바구니에 추가할 부품을 선택하세요"});
            toastEvent.fire();   
            return false;
        }
        var items = [];
        partsToCart.forEach(item => {
            if(item.Partnum__c) { // 호환 세트 모달 이벤트로 넘어온 값
                items.push({"partNumber":item.Partnum__c, "quantity":item.Quantity__c ? item.Quantity__c : 1});
            } else { // 일반 wishlistitem
                items.push({"partNumber":item.Product2.Part__r.Partnum__c, "quantity":item.Quantity__c ? item.Quantity__c : 1});
            }
        });
        let mapData = {"item": items,'orderType':orderType};
        console.log('mapData : ', mapData);
        let action = component.get("c.addToCart");
        action.setParams({ "mapData" : mapData});
        component.set("v.isDone",false);
        action.setCallback(this, function(response) {
            let responseValue = response.getReturnValue();
            console.log('## addToCart : ', responseValue);

            if(responseValue.result == 'NOK') {
                $A.get("e.force:showToast")
                    .setParams({"type": "error","title": "장바구니 추가 실패","message": responseValue.message})
                    .fire();
            } else {
                $A.get("e.force:showToast")
                    .setParams({"type": "success","title": "장바구니 추가","message": "장바구니에 부품이 추가되었습니다."})
                    .fire();
            }
            
            component.set("v.isDone",true);
            component.set("v.isShowCompSet", false);
            component.set('v.isSelectObjCode',false);
            component.find("cartChanged").publish();
        });
        $A.enqueueAction(action);
    },
    handlePartNumberEvent: function(component, event) {
        var partNumbers = event.getParam("partNumbers");
        console.log('## handlePartNumberEvent in MyPartList ##', partNumbers);
        var partsToCart = component.get("v.partsToCart");
        var selectedLeftModalBuffer = component.get("v.selectedLeftModalBuffer");

        var action = component.get("c.getPartInAddCart");
        action.setParams({ "mapData" : {"data" : partNumbers} });
        action.setCallback(this, function(response) {
            var responseValue = response.getReturnValue(); 
            console.log('## handlePartNumberEvent in MyPartList ## ',responseValue);
            Object.keys(responseValue.payload.parts).forEach(function(key) {
                var value = responseValue.payload.parts[key];
                partsToCart.push(value);
            });
            console.log('## handlePartNumberEvent : ', partsToCart);
            component.set("v.partsToCart", partsToCart);

            component.set("v.isShowCompSet", false);
            if (selectedLeftModalBuffer.length > 0) {
                var removedElement = selectedLeftModalBuffer.shift();
                component.set("v.checkPartNumber", removedElement.PartNumber);
                component.set("v.checkQuantity", removedElement.Quantity__c);
                // component.set("v.checkPartNumber", selectedLeftModalBuffer.shift().PartNumber);
                component.set("v.selectedLeftModalBuffer", selectedLeftModalBuffer);
                component.set("v.isShowCompSet", true);
            } else {
                console.log('## add cart gogo in handlePartNumberEvent ##');
                this.addToCart(component, event);
            }
        });
        $A.enqueueAction(action);
    },
    getIsDistributor: function(component){
        console.log('## getIsDistributor ##');
        var action = component.get("c.getIsDistributor");
        action.setCallback(this, function(response) {
            var responseValue = response.getReturnValue(); 
            console.log('## getIsDistributor ## ',responseValue);
            component.set('v.isDistributor',responseValue);
            this.setDataTables(component);
            this.getMyPartsList(component);
        });
        $A.enqueueAction(action);
    },
    
    cloneToCart : function(component, event) {
        var selectedBuffer = component.get("v.selectedBuffer");
        console.log('selectedBuffer',selectedBuffer);
        component.set("v.partsToCart", selectedBuffer.filter(item => item.isCompSet__c == false));
        component.set("v.selectedLeftModalBuffer", selectedBuffer.filter(item => item.isCompSet__c == true));
        var selectedLeftModalBuffer = component.get("v.selectedLeftModalBuffer");
        if (selectedLeftModalBuffer.length > 0) {
            var removedElement = selectedLeftModalBuffer.shift();
            component.set("v.checkPartNumber", removedElement.PartNumber);
            component.set("v.checkQuantity", removedElement.Quantity__c);
            console.log('❤️❤️❤️ selectedLeftModalBuffer.PartNumber',removedElement.PartNumber);
            console.log('❤️❤️❤️ selectedLeftModalBuffer.Quantity__c',removedElement.Quantity__c);
            component.set("v.selectedLeftModalBuffer", selectedLeftModalBuffer);
            component.set("v.isShowCompSet", true);
        } else {
            this.addToCart(component, event);
        }
    },

})