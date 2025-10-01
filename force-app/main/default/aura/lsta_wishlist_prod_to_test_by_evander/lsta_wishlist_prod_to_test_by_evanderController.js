/****************************************************************************************
 * @filename        : PartOrderMyPartListController.js
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
 * ======================================================================================
 *  ver     date        author      description
 * ======================================================================================
    0.1     2023.10.05  K(xanitus)  create       
    0.2     2023.11.15  K(xanitus)  목록추가를 찜 목록 및 장바구니 추가로 분리
    0.3     2023.11.22  K(xanitus)  단가 추가
 ****************************************************************************************/
    ({
        doInit : function(component, event, helper) {
            component.set("v.isDone",false);
            helper.getIsDistributor(component);
            // helper.setDataTables(component);
            // helper.getMyPartsList(component);
        },
        onRender : function(component, event, helper) {
        },
        onLoadJQuery : function(component, event, helper) {
        },
        onClickPrintOnMyPartList : function(component) {
            let sitePrefix = component.get("v.sitePrefix");
            // window.open('/apex/PartOrderPrint?printType=mylist&targetId=' + $A.get("$SObjectType.CurrentUser.Id"),'','height=600,width=800'); 
            let url = '/' + sitePrefix + '/apex/PartOrderPrint?d=' + Math.random() + '&printType=mylist&targetId=' + $A.get("$SObjectType.CurrentUser.Id");
            let listSource = component.get("v.selectedBuffer");
            let checkedId = "";
            if(listSource.length == 0) {
                $A.get("e.force:showToast")
                .setParams({"title": "주문 출력","message": "출력할 자료를 선택하세요", "type": "error"})
                .fire();    
                return false;
            }
            listSource.forEach(element => {
                checkedId += element.Id + ',';
            });
            checkedId = checkedId.substring(0,checkedId.length-1);
            let formId = ('dynamicForm' + Math.random()).replace('.','');
            let formDynamic = $('<form>', {'id': formId, 'action': url, 'method':'POST', 'target':'_blank'});        
            let elementCheckedId = $('<input>',{'name' : 'checkedId', 'value' : checkedId});
            formDynamic.append(elementCheckedId);
            $(document.body).append(formDynamic);
            $('#' + formId).submit();
        },
        onClickNewMyPartList : function(component, event, helper) {
            helper.toggleIsNewPartList(component);
        },
        onClickSaveOnMyPartsListModal : function(component, event, helper) {
            helper.addMyPartList(component);
            helper.toggleIsNewPartList(component);
        },
        onSelectMyPartList : function(component, event, helper) {
            let selectedMenu = event.detail.menuItem.get("v.value");
            if(selectedMenu.startsWith('id:') == true) {           
                let recordId = selectedMenu.substring(3,selectedMenu.length);
                component.set("v.myProductListId",recordId);
                let target = component.get("v.myPartsList");
                for(let x = 0; x < target.length; x ++ ) {
                    if(target[x].Id == recordId) {
                        component.set("v.myPartsListItem",target[x]);     
                        component.set("v.isMyList",true);
                        break;
                    }
                }
            }
        },
        onClicEditMyPartListName : function(component,event,helper) {
            helper.toggleIsEditMyPartListName(component);
        },
        onClickSaveOnEditMyPartListName : function(component,event,helper) {
            let target = component.find("textEditedMyPartsListName");
            let values = target.get("v.value");
            if(values == "" || typeof values == "undefined") {
                target.set("v.errors", [{
                    message: "필수 입력 항목 입니다."
                }]);
                $A.util.addClass(target, 'slds-has-error');
            } else {
                $A.util.removeClass(target, 'slds-has-error');
                let action = component.get("c.editMyPartList");
                let mapData = {"Id": component.get("v.myPartsListItem").Id,"name": values,"description": component.find("textMEdtiedyPartsLisDescription").get("v.value")};
                action.setParams({ "mapData" : mapData});
                action.setCallback(this, function(response) {
                    let responseValue = response.getReturnValue(); 
                    component.set("v.myPartsListId", component.get("v.myPartsListItem").Id);
                    helper.getMyPartsList(component);     
                    let toastEvent = $A.get("e.force:showToast");
                    toastEvent.setParams({"type": "success","title": "부품 목록 수정","message": "부품 목록이 수정 되었습니다"});
                    toastEvent.fire();   
                    helper.toggleIsEditMyPartListName(component);               
                });
                $A.enqueueAction(action);
            }
        },
        onClickAddOnMyPartsList : function(component,event,helper) {
            component.set("v.partsList",[]);
            component.set("v.selectedBufferByAdd",[]);
            helper.toggleIsAddPartsInPartList(component);
        },
        onHandlePartNumberEvent: function(component, event, helper) {
            helper.handlePartNumberEvent(component, event);
        },
        onclickCloneToCart : function(component, event, helper) {
            var isDistributor = component.get('v.isDistributor');
            var selectedBuffer = component.get("v.selectedBuffer");
            if(selectedBuffer.length == 0) {
                let toastEvent = $A.get("e.force:showToast");
                toastEvent.setParams({"type": "error","title": "부품 선택","message": "장바구니에 추가할 부품을 선택하세요"});
                toastEvent.fire();   
                return false;
            }
            if(isDistributor){
                component.set('v.isSelectObjCode',true);
            }else{
                helper.cloneToCart(component,event,'Default Delivery');
            }
        },
        clickSaveOnMyPartsCloneModal : function(component, event, helper) {
            let selectedBuffer = component.get("v.selectedBuffer");                        
            let selectedBufferTarget = component.get("v.selectedBufferTarget");
            if(selectedBufferTarget.length == 0) {
                $A.get("e.force:showToast")
                .setParams({"type": "error","title": "대상 선택","message": "대상 목록을 선택하세요"})
                .fire();   
                return false;
            }
//          DESC : 복제 또는 이동 여부에 따라 항목은 삭제 될 수 있다
            selectedBufferTarget.forEach(element => delete element.WishlistItems);
            let action = component.get("c.clonePartList");
            let mapData = {"partsListItem": selectedBuffer,"partList": selectedBufferTarget,"type": component.get("v.isTypeClone") == true ? 'clone' : 'move'};
            action.setParams({ "mapData" : mapData});
            component.set("v.isDone",false);
            action.setCallback(this, function(response) {
                let responseValue = response.getReturnValue(); 
                component.set("v.myPartsListId", component.get("v.myPartsListItem").Id);
                helper.toggleIsCloneMyParts(component);
                $A.get("e.force:showToast")
                .setParams({"type": "success","title": "복제/이동","message": "작업이 완료 되었습니다"})
                .fire();   
                helper.getMyPartsList(component);
                component.set("v.isDone",true);
            });
            $A.enqueueAction(action);
        },
        onClickSaveOnAddPartModalInPartList : function(component, event, helper) {
            let listBuffer = component.get("v.selectedBufferByAdd");
            let myPartList = component.get("v.myPartsListItem");
            let apiBuffer = {"myParstList":myPartList.Id,"partsList":[]};
            for(let x = 0; x < listBuffer.length; x ++) {
                if (listBuffer[x].Quantity__c == undefined || listBuffer[x].Quantity__c <= 0) {
                    $A.get("e.force:showToast")
                    .setParams({"title": "부품 추가","message": listBuffer[x].Partnum__c + " 상품 수량을 잘못 입력하였습니다.", "type": "error"})
                    .fire();
                    throw new Error("Invalid quantity");
                }
                apiBuffer.partsList.push(listBuffer[x]);
            }
            if(apiBuffer.partsList.length > 0) {
                let action = component.get("c.addMyPartListItems");
                action.setParams({ "mapData" : apiBuffer});
                action.setCallback(this, function(response) {
                    let responseValue = response.getReturnValue(); 
                    component.set("v.myPartsListId", myPartList.Id);
                    helper.getMyPartsList(component);
                    component.set("v.isDone",true);
                    let toastEvent = $A.get("e.force:showToast");
                    if(responseValue.result == 'OK')
                            toastEvent.setParams({"type": "success","title": "부품 등록","message": "부품이 등록 되었습니다"});
                    else    toastEvent.setParams({"type": "error","title": "부품 등록","message": "부품 등록이 실패되었습니다"});
                    toastEvent.fire();   
                    helper.toggleIsAddPartsInPartList(component);
                });
                $A.enqueueAction(action);
            }
        },
        onClickSearchOnAddPartModalInPartList : function(component, event, helper) {            
            component.set("v.partsList",[]);
//          DESC : 적어도 하나의 검색어는 있어야 한다.
            if( component.find("textAddedMyPartsNo").get("v.value") == ''
            &&  component.find("textAddedMyPartsName").get("v.value") == ''
            &&  component.find("textAddedMyPartsNoPrev").get("v.value") == '') {
                let toastEvent = $A.get("e.force:showToast");
                toastEvent.setParams({"type": "error","title": "부품 검색","message": "적어도 하나의 검색 조건은 입력하셔야 합니다"});
                toastEvent.fire();   
                return false;
            }
            helper.searchPartsToAdd(component);
        },
        onSelectTableRows : function(component, event, helper) {   
            component.set("v.selectedBuffer",event.getParam('selectedRows'));
        },
        onSelectTableRowByAdd: function(component, event, helper) {
            var selectedBuffer = component.get("v.selectedBufferByAdd");
            var checkboxValue = event.getSource().get("v.value");
            var isChecked = event.getSource().get("v.checked");
            if(isChecked) {
                selectedBuffer.push(checkboxValue);
            } else {
                var index = selectedBuffer.findIndex(item => item.Partnum__c === checkboxValue.Partnum__c);
                if(index > -1) {
                    selectedBuffer.splice(index, 1);
                }
            }
            component.set("v.selectedBufferByAdd", selectedBuffer);
        },
        onClickDeleteOnMyPartsList : function(component, event, helper) {   
            let listBuffer = component.get("v.selectedBuffer");
            if(listBuffer.length == 0) {
                let toastEvent = $A.get("e.force:showToast");
                toastEvent.setParams({"type": "error","title": "부품 삭제","message": "삭제할 부품을 선택하세요"});
                toastEvent.fire();   
                return false;
            }
            component.set("v.isDone",false);
            let action = component.get("c.removeMyPartListItems");
//          DESC : 삭제할 레코드 아이디 설정            
            let mapData = {"Id": []};
            for(let x = 0; x < listBuffer.length; x ++)  mapData.Id.push(listBuffer[x].Id);
            action.setParams({ "mapData" : mapData});
            action.setCallback(this, function(response) {
                let responseValue = response.getReturnValue(); 
                component.set("v.myPartsListId", component.get("v.myPartsListItem").Id);
                helper.getMyPartsList(component);
                component.set("v.isDone",true);
                let toastEvent = $A.get("e.force:showToast");
                toastEvent.setParams({"type": "success","title": "부품 삭제","message": "부품이 삭제 되었습니다"});
                toastEvent.fire();   
            });
            $A.enqueueAction(action);
        },
        clickDeleteListOnMyPartList : function(component, event, helper) {   
            let action = component.get("c.removePartList");
            let mapData = {"Id": component.get("v.myPartsListItem").Id};
            action.setParams({ "mapData" : mapData});
            action.setCallback(this, function(response) {
                let responseValue = response.getReturnValue(); 
//              TODO : 삭제후, 첫번쨰 리스트로 이동 해야 하는가 ? 또는 다른 화면으로 이동 해야 하는가 ?
                component.set("v.myPartsListItem",component.get("v.myPartsList")[0]); 
                helper.getMyPartsList(component);
                let toastEvent = $A.get("e.force:showToast");
                toastEvent.setParams({"type": "success","title": "목록 삭제","message": "목록이 삭제 되었습니다"});
                toastEvent.fire();   
                component.set("v.isDone",true);
            });
            $A.enqueueAction(action);
        },
        clickClearListOnMyPartList : function(component, event, helper) {
            let action = component.get("c.removeAllyPartListItems");
            let mapData = {"Id": component.get("v.myPartsListItem").Id};
            action.setParams({ "mapData" : mapData});
            action.setCallback(this, function(response) {
                let responseValue = response.getReturnValue(); 
                component.set("v.myPartsListId", component.get("v.myPartsListItem").Id);
                helper.getMyPartsList(component);
            });
            $A.enqueueAction(action);                
        },
        onClickUploadButtonOnMyPartList : function(component, event, helper) {
            component.set("v.isUploadMyPartListFile",!component.get("v.isUploadMyPartListFile"));
        },
        onDoneMyPartFileUpload : function(component, event, helper) {
            let uploadedFiles = event.getParam("files");
            let myPartsListId = component.get("v.myPartsListItem").Id;
            let mapData = {"myPartsListId": myPartsListId, "contentDocumentId": uploadedFiles[0].documentId};
            let action = component.get("c.parseMyPartsItemCSVFile");
            action.setParams({ "mapData" : mapData});
            action.setCallback(this, function(response) {
                let responseValue = response.getReturnValue(); 
                component.set("v.myPartsListId", myPartsListId);
                helper.getMyPartsList(component);
            });
            $A.enqueueAction(action);
        },
        onClickDownloadButtonOnMyPartList : function(component, event, helper) {
            let csvContent = "data:text/csv;charset=utf-8,";
            let csvCols = ['찜 목록','자재 번호','수량','비고'];
            csvContent += "\ufeff" + csvCols.join(',') + "\r\n";
            let encodedUri = encodeURI(csvContent);
            let link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "찜 목록 업로드 양식.csv");
            document.body.appendChild(link); 
            link.click(); 
        },
        clickCliseOnMyPartsList : function(component, event, helper) {            
            helper.toggleIsCloneMyParts(component);
        },
        onClickCloneOnMyPartsList : function(component, event, helper) {            
            let selectedBuffer = component.get("v.selectedBuffer");            
            if(selectedBuffer.length == 0) {
                let toastEvent = $A.get("e.force:showToast");
                toastEvent.setParams({"type": "error","title": "부품 선택","message": "찜 목록에 추가할 부품을 선택하세요"});
                toastEvent.fire();   
                return false;
            }
            component.set("v.isTypeClone",true);
            helper.toggleIsCloneMyParts(component);
        },
        clickMoveOnMyPartsList : function(component, event, helper) {
            let selectedBuffer = component.get("v.selectedBuffer");            
            if(selectedBuffer.length == 0) {
                let toastEvent = $A.get("e.force:showToast");
                toastEvent.setParams({"type": "error","title": "부품 선택","message": "이동할 부품을 선택하세요"});
                toastEvent.fire();   
                return false;
            }
            component.set("v.isTypeClone",false);
            helper.toggleIsCloneMyParts(component);
        },
        onSelectTableRowsTarget : function(component, event, helper) {   
            component.set("v.selectedBufferTarget",event.getParam('selectedRows'));
        },
        clickSaveOnMyPartsCloneModal : function(component, event, helper) {
            let selectedBuffer = component.get("v.selectedBuffer");                        
            let selectedBufferTarget = component.get("v.selectedBufferTarget");
            if(selectedBufferTarget.length == 0) {
                let toastEvent = $A.get("e.force:showToast");
                toastEvent.setParams({"type": "error","title": "대상 선택","message": "대상 목록을 선택하세요"});
                toastEvent.fire();   
                return false;
            }
//          DESC : 복제 또는 이동 여부에 따라 항목은 삭제 될 수 있다
            selectedBufferTarget.forEach(element => delete element.WishlistItems);
            let action = component.get("c.clonePartList");
            let mapData = {"partsListItem": selectedBuffer,"partList": selectedBufferTarget,"type": component.get("v.isTypeClone") == true ? 'clone' : 'move'};
            action.setParams({ "mapData" : mapData});
            component.set("v.isDone",false);
            action.setCallback(this, function(response) {
                let responseValue = response.getReturnValue(); 
                component.set("v.myPartsListId", component.get("v.myPartsListItem").Id);
                helper.toggleIsCloneMyParts(component);
                let toastEvent = $A.get("e.force:showToast");
                toastEvent.setParams({"type": "success","title": "복제/이동","message": "작업이 완료 되었습니다"});
                toastEvent.fire();   
                helper.getMyPartsList(component);
                component.set("v.isDone",true);
                component.find("cartChanged").publish();
                console.log('되나요 ?');
            });
            $A.enqueueAction(action);
        },
        onSaveTableRows : function(component,event,helper) {
            let target = event.getParam("draftValues");
            for(let x = 0; x < target.length; x ++ ) {
                if(target[x].Quantity__c == '') {
                    let toastEvent = $A.get("e.force:showToast");
                    toastEvent.setParams({"type": "error","title": "수량 변경","message": "수량을 입력하세요"});
                    toastEvent.fire();   
                    return false;
                }
            }
            component.set("v.isDone",false);
            let myPartList = component.get("v.myPartsListItem");
            let mapData = {"myParstList" : myPartList.Id,"myPartListItems" : target};
            let action = component.get("c.editMyPartListItems");
            action.setParams({ "mapData" : mapData});
            action.setCallback(this, function(response) {
                let responseValue = response.getReturnValue(); 
                let toastEvent = $A.get("e.force:showToast");
                toastEvent.setParams({"type": "success","title": "수량 변경","message": "수량이 변경되었습니다"});
                toastEvent.fire();   
                component.set("v.isDone",true);
                component.set("v.draftValues",[]);
                component.set("v.myProductListId",myPartList.Id);
                // $A.get('e.force:refreshView').fire();
                helper.getMyPartsList(component);
            });
            $A.enqueueAction(action);
        }, 
        onclickCancelSelectObjCode: function(component, event, helper){
            component.set('v.isSelectObjCode',false);
        },
        onClickAddToCart: function(component, evnet, helper){
            helper.cloneToCart(component,evnet);
        },
        handleOrderTypeChange: function(component, event, helper){
            var selectedOrderType = event.getParam("value");
            component.set("v.selectedOrderType", selectedOrderType);
        },
        onKeyUpSearchOnAddPartModalInCart : function(component, event, helper){
            if (event.which === 13) {
                component.set("v.partsList",[]);
    //          DESC : 적어도 하나의 검색어는 있어야 한다.
                if( component.find("textAddedMyPartsNo").get("v.value") == ''
                &&  component.find("textAddedMyPartsName").get("v.value") == ''
                &&  component.find("textAddedMyPartsNoPrev").get("v.value") == '') {
                    let toastEvent = $A.get("e.force:showToast");
                    toastEvent.setParams({"type": "error","title": "부품 검색","message": "적어도 하나의 검색 조건은 입력하셔야 합니다"});
                    toastEvent.fire();   
                    return false;
                }
                helper.searchPartsToAdd(component);
            }
        },
        handlePrefixLoaded : function(component, event, helper) {
            const prefix = event.getParam('prefix');
            component.set("v.sitePrefix", prefix);
        },
    })